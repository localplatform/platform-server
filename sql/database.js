import { Sequelize } from 'sequelize'
import dotenv from 'dotenv'
dotenv.config()

const { SQL_SERVER, SQL_ACCOUNT, SQL_PASSWORD } = process.env

const sequelizePlatform = new Sequelize('dataverse', SQL_ACCOUNT, SQL_PASSWORD, {
    host: SQL_SERVER,
    dialect: 'mssql',
    logging: false,
    port: 8000,
    dialectOptions: {
        instanceName: 'PLATFORM'
    },
    define: {
        timestamps: false
    }
})

export default sequelizePlatform