const fs = require('fs');

const sql = 
SELECT pg_get_functiondef('calculate_evento_metrics'::regproc) as definition;
;

console.log(sql);
