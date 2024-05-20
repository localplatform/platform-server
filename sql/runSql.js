import { Sequelize } from 'sequelize'

const { SQL_SERVER, SQL_ACCOUNT, SQL_PASSWORD } = process.env

export async function runSql(query, database) {
    const sequelizeAdmin = new Sequelize(database, SQL_ACCOUNT, SQL_PASSWORD, {
        host: SQL_SERVER,
        dialect: 'mssql',
        logging: false,
        port: 8000,
        dialectOptions: {
            instanceName: 'PLATFORM'
        }
    })

    try {
        const [results] = await sequelizeAdmin.query(query)
        await sequelizeAdmin.close()
        return results
    } catch (error) {
        console.error("Erreur lors de l'exécution de la requête :", error)
        throw error
    }
}