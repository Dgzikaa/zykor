const fs = require('fs');

// Ler o SQL
const sql = fs.readFileSync('c:/Projects/zykor/temp_function_dynamic_arrays.sql', 'utf8');

// Criar JSON para o MCP
const mcpRequest = {
  server: 'project-0-zykor-supabase',
  tool: 'execute_sql',
  arguments: {
    project_id: 'uqtgsvujwcbymjmvkjhy',
    query: sql
  }
};

console.log(JSON.stringify(mcpRequest, null, 2));