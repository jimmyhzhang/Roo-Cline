#!/usr/bin/env python3
import argparse
import json
import sys
import sqlite3
import numpy as np
import logging
import os
from datetime import datetime
from sentence_transformers import SentenceTransformer
from pathlib import Path
from typing import List, Dict, Any

# Set up logging
def setup_logging():
    """Configure logging to write to both file and stderr."""
    logs_dir = Path("logs")
    logs_dir.mkdir(exist_ok=True)
    
    log_file = logs_dir / f"chromadb_{datetime.now().strftime('%Y%m%d')}.log"
    
    # Configure logging format
    formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # File handler
    file_handler = logging.FileHandler(log_file)
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)
    
    # Stream handler (stderr)
    stream_handler = logging.StreamHandler(sys.stderr)
    stream_handler.setFormatter(formatter)
    stream_handler.setLevel(logging.WARNING)
    
    # Root logger
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    logger.addHandler(file_handler)
    logger.addHandler(stream_handler)
    
    return logger

logger = setup_logging()

class VectorDB:
    def __init__(self, db_path: str = "vector_db.sqlite"):
        self.db_path = db_path
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        logger.info(f"Initializing VectorDB with path: {db_path}")
        self._init_db()

    def _init_db(self):
        """Initialize the SQLite database with necessary tables."""
        logger.info("Initializing database tables")
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        try:
            # Create tables if they don't exist
            c.execute('''
                CREATE TABLE IF NOT EXISTS collections (
                    id INTEGER PRIMARY KEY,
                    name TEXT UNIQUE
                )
            ''')
            
            c.execute('''
                CREATE TABLE IF NOT EXISTS documents (
                    id INTEGER PRIMARY KEY,
                    collection_id INTEGER,
                    text TEXT,
                    metadata TEXT,
                    embedding BLOB,
                    FOREIGN KEY (collection_id) REFERENCES collections (id)
                )
            ''')
            
            conn.commit()
            logger.info("Database tables initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing database: {str(e)}")
            raise
        finally:
            conn.close()

    def _get_or_create_collection(self, collection_name: str) -> int:
        """Get collection ID or create if it doesn't exist."""
        logger.info(f"Getting or creating collection: {collection_name}")
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        try:
            c.execute('SELECT id FROM collections WHERE name = ?', (collection_name,))
            result = c.fetchone()
            
            if result:
                collection_id = result[0]
                logger.info(f"Found existing collection with ID: {collection_id}")
            else:
                c.execute('INSERT INTO collections (name) VALUES (?)', (collection_name,))
                collection_id = c.lastrowid
                logger.info(f"Created new collection with ID: {collection_id}")
            
            conn.commit()
            return collection_id
        except Exception as e:
            logger.error(f"Error in get_or_create_collection: {str(e)}")
            raise
        finally:
            conn.close()

    def write(self, collection: str, text: str, metadata: Dict[str, Any] = None) -> str:
        """Write a document to the vector database."""
        try:
            logger.info(f"Writing to collection '{collection}' with metadata: {metadata}")
            
            # Generate embedding
            embedding = self.model.encode([text])[0]
            logger.debug(f"Generated embedding of shape: {embedding.shape}")
            
            # Convert metadata to JSON string if provided
            metadata_str = json.dumps(metadata) if metadata else None
            
            # Get collection ID
            collection_id = self._get_or_create_collection(collection)
            
            # Store document and embedding
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            
            c.execute('''
                INSERT INTO documents (collection_id, text, metadata, embedding)
                VALUES (?, ?, ?, ?)
            ''', (collection_id, text, metadata_str, embedding.tobytes()))
            
            doc_id = c.lastrowid
            conn.commit()
            conn.close()
            
            logger.info(f"Successfully wrote document {doc_id} to collection '{collection}'")
            return json.dumps({
                "status": "success",
                "message": f"Successfully wrote document {doc_id} to collection '{collection}'",
                "id": doc_id
            })
            
        except Exception as e:
            error_msg = f"Error writing to database: {str(e)}"
            logger.error(error_msg)
            return json.dumps({
                "status": "error",
                "message": error_msg
            })

    def query(self, collection: str, query: str, n_results: int = 5) -> str:
        """Query the vector database for similar documents."""
        try:
            logger.info(f"Querying collection '{collection}' with query: {query}")
            
            # Generate query embedding
            query_embedding = self.model.encode([query])[0]
            logger.debug(f"Generated query embedding of shape: {query_embedding.shape}")
            
            # Get collection ID
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            
            c.execute('SELECT id FROM collections WHERE name = ?', (collection,))
            result = c.fetchone()
            if not result:
                error_msg = f"Collection '{collection}' not found"
                logger.error(error_msg)
                return json.dumps({
                    "status": "error",
                    "message": error_msg
                })
            
            collection_id = result[0]
            
            # Get all documents from the collection
            c.execute('''
                SELECT id, text, metadata, embedding
                FROM documents
                WHERE collection_id = ?
            ''', (collection_id,))
            
            documents = []
            similarities = []
            
            for doc_id, text, metadata_str, embedding_bytes in c.fetchall():
                embedding = np.frombuffer(embedding_bytes, dtype=np.float32)
                similarity = np.dot(query_embedding, embedding) / (
                    np.linalg.norm(query_embedding) * np.linalg.norm(embedding)
                )
                
                documents.append({
                    "id": doc_id,
                    "text": text,
                    "metadata": json.loads(metadata_str) if metadata_str else None,
                    "similarity": float(similarity)
                })
                similarities.append(similarity)
            
            # Sort by similarity and get top N results
            sorted_indices = np.argsort(similarities)[::-1][:n_results]
            top_results = [documents[i] for i in sorted_indices]
            
            conn.close()
            
            logger.info(f"Found {len(top_results)} results for query in collection '{collection}'")
            return json.dumps({
                "status": "success",
                "results": top_results
            })
            
        except Exception as e:
            error_msg = f"Error querying database: {str(e)}"
            logger.error(error_msg)
            return json.dumps({
                "status": "error",
                "message": error_msg
            })

def main():
    parser = argparse.ArgumentParser(description='Vector Database Tool')
    parser.add_argument('action', choices=['write', 'query'], help='Action to perform')
    parser.add_argument('--collection', required=True, help='Collection name')
    parser.add_argument('--text', help='Text content to write')
    parser.add_argument('--metadata', help='JSON metadata string')
    parser.add_argument('--query', help='Query text')
    parser.add_argument('--n-results', type=int, default=5, help='Number of results to return')
    
    args = parser.parse_args()
    
    # Initialize vector database
    db = VectorDB()
    
    if args.action == 'write':
        if not args.text:
            logger.error("Error: --text is required for write action")
            print("Error: --text is required for write action", file=sys.stderr)
            sys.exit(1)
        metadata = json.loads(args.metadata) if args.metadata else None
        result = db.write(args.collection, args.text, metadata)
        print(result)
    
    elif args.action == 'query':
        if not args.query:
            logger.error("Error: --query is required for query action")
            print("Error: --query is required for query action", file=sys.stderr)
            sys.exit(1)
        result = db.query(args.collection, args.query, args.n_results)
        print(result)

if __name__ == '__main__':
    main() 