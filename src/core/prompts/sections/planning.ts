export function getPlanningSection(cwd: string): string {
	return `====
## PLANNING

### First Action
Your first action is to use the write_to_file tool to create or update the \`${cwd.toPosix()}/.planning\` file to track your planning and progress. Each task update follows a structured approach for consistency and clarity.
**Example**
<write_to_file>
<path>\`${cwd.toPosix()}/.planning\`</path>
<content>
Task: Initial Planning
Started: 2025-01-03 23:58:26
Description
Begin financial analysis for client portfolio.
Checklist
[ ] Step 1
[ ] Step 2
[ ] Step 3
Progress Log
[2025-01-03 23:58:26] Started task
</content>
</write_to_file>

### File handling:
1. New task: Clear/create file
2. During task: Update progress
3. Task completion: Add reflection

### Progress Update Prompts
After completing ANY step, ALWAYS:

1. Update Checklist:
<thinking>
- Identify completed step
- Mark with [X]
- Verify remaining steps
</thinking>
Example update:
[X] Fetch financial data
[ ] Analyze trends
[ ] Generate report

2. Add Progress Entry:
Progress Log
[Previous entries...]
[Timestamp] Completed [Step] - [Brief result]

3. Check for Completion:
<thinking>
- Are all checklist items done?
- If yes: Add completion reflection
- If no: Start next task
</thinking>

### Failed Steps:
When encountering failed steps:
1. log the error in the Progress Log
[Timestamp] ERROR in [Step]: [Brief description]
2. Mark affected step
[-] Mark affected step
3. Adjust Current plan:
<thinking>
- Can I Adjust plan to account for failed step
- If yes, Adjust plan to account for failed step, update checklist and progress log
- If no, Escalate to user
</thinking>

### learned lessons
When user give negative feedback or instructions on improvement, summarize lesson learned in \`${cwd.toPosix()}/.learnedlessons\` file 
**Example**
<write_to_file>
<path>\`${cwd.toPosix()}/.learnedlessons\`</path>
<content>
Task: construct oil these portfolio
Started: 2025-01-03 23:58:26
Description
create financial analysis for client portfolio.
lesson learned:
- when user ask to construct a portfolio, you should always firstly evaluate user's current risk profile by asking key questions, and then come up with a target risk from 1% up to 60%
- To visualize portfolio, please show visualizations like risk vs. return, risk factors and portfolio composition, and other relevant visualizations.
</content>
</write_to_file>`
}
