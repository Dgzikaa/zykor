const fs = require('fs');
const { execSync } = require('child_process');

const sql = "SELECT pg_get_functiondef('calculate_evento_metrics'::regproc);";
const jsonArg = JSON.stringify({sql});

try {
  const result = execSync(`cursor mcp call project-0-zykor-supabase_sql query "${jsonArg.replace(/"/g, '\\"')}"`, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
  
  fs.writeFileSync('temp_function_output3.txt', result);
  console.log('Success! Saved to temp_function_output3.txt');
  console.log('Length:', result.length);
} catch (error) {
  console.error('Error:', error.message);
  fs.writeFileSync('temp_function_error.txt', error.toString());
}
