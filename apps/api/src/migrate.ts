import {migrate,pool} from './db/index.js';await migrate();await pool.end();console.log('Migrations complete');
