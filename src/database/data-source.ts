import { config } from 'dotenv';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { TYPEORM_ENTITIES } from './typeorm-entities';

config({ path: join(__dirname, '..', '..', '.env') });

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'hms_db',
  entities: [...TYPEORM_ENTITIES],
  migrations: [join(__dirname, 'migrations', '*.ts')],
  synchronize: false,
});
