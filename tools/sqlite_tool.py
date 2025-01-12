#!/usr/bin/env python3

import argparse
import json
import logging
import os
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Any, Dict, List, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)


class SqliteDatabase:
    def __init__(self, db_path: str):
        """Initialize SQLite database connection."""
        self.db_path = str(Path(db_path).expanduser())
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_database()
        self.insights: List[str] = []

    def _init_database(self):
        """Initialize connection to the SQLite database."""
        logger.debug("Initializing database connection")
        with closing(sqlite3.connect(self.db_path)) as conn:
            conn.row_factory = sqlite3.Row
            conn.close()

    def _execute_query(
        self, query: str, params: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Execute a SQL query and return results as a list of dictionaries."""
        logger.debug(f"Executing query: {query}")
        try:
            with closing(sqlite3.connect(self.db_path)) as conn:
                conn.row_factory = sqlite3.Row
                with closing(conn.cursor()) as cursor:
                    if params:
                        cursor.execute(query, params)
                    else:
                        cursor.execute(query)

                    if (
                        query.strip()
                        .upper()
                        .startswith(
                            ("INSERT", "UPDATE", "DELETE", "CREATE", "DROP", "ALTER")
                        )
                    ):
                        conn.commit()
                        affected = cursor.rowcount
                        logger.debug(f"Write query affected {affected} rows")
                        return [{"affected_rows": affected}]

                    results = [dict(row) for row in cursor.fetchall()]
                    logger.debug(f"Read query returned {len(results)} rows")
                    return results
        except Exception as e:
            logger.error(f"Database error executing query: {e}")
            raise

    def read_query(self, query: str) -> List[Dict[str, Any]]:
        """Execute a SELECT query."""
        if not query.strip().upper().startswith("SELECT"):
            raise ValueError("Only SELECT queries are allowed for read_query")
        return self._execute_query(query)

    def write_query(self, query: str) -> List[Dict[str, Any]]:
        """Execute an INSERT, UPDATE, or DELETE query."""
        if query.strip().upper().startswith("SELECT"):
            raise ValueError("SELECT queries are not allowed for write_query")
        return self._execute_query(query)

    def create_table(self, query: str) -> List[Dict[str, Any]]:
        """Create a new table."""
        if not query.strip().upper().startswith("CREATE TABLE"):
            raise ValueError("Only CREATE TABLE statements are allowed")
        return self._execute_query(query)

    def list_tables(self) -> List[Dict[str, Any]]:
        """List all tables in the database."""
        return self._execute_query("SELECT name FROM sqlite_master WHERE type='table'")

    def describe_table(self, table_name: str) -> List[Dict[str, Any]]:
        """Get schema information for a table."""
        return self._execute_query(f"PRAGMA table_info({table_name})")


def main():
    parser = argparse.ArgumentParser(description="SQLite database tool")
    parser.add_argument(
        "action", choices=["read", "write", "create_table", "list_tables", "describe"]
    )
    parser.add_argument("--db", required=True, help="Path to SQLite database file")
    parser.add_argument("--query", help="SQL query to execute")
    parser.add_argument("--table", help="Table name for describe action")

    args = parser.parse_args()

    try:
        db = SqliteDatabase(args.db)

        if args.action == "read":
            if not args.query:
                parser.error("--query is required for read action")
            result = db.read_query(args.query)

        elif args.action == "write":
            if not args.query:
                parser.error("--query is required for write action")
            result = db.write_query(args.query)

        elif args.action == "create_table":
            if not args.query:
                parser.error("--query is required for create_table action")
            result = db.create_table(args.query)

        elif args.action == "list_tables":
            result = db.list_tables()

        elif args.action == "describe":
            if not args.table:
                parser.error("--table is required for describe action")
            result = db.describe_table(args.table)

        print(json.dumps(result, indent=2))

    except Exception as e:
        logger.error(f"Error: {str(e)}")
        exit(1)


if __name__ == "__main__":
    main()
