require('dotenv').config({path:'../.env.local'});
const {Client} = require('pg');
const client = new Client({connectionString: process.env.DATABASE_URL});

client.connect()
  .then(() => client.query("SELECT pg_get_functiondef('calculate_evento_metrics'::regproc);"))
  .then(r => {
    console.log(r.rows[0].pg_get_functiondef);
    client.end();
  })
  .catch(e => {
    console.error(e);
    client.end();
  });
