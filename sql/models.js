import { DataTypes } from 'sequelize'
import sequelizePlatform from './database.js'

const Users = sequelizePlatform.define('users', {
    userid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    firstname: { type: DataTypes.STRING },
    lastname: { type: DataTypes.STRING },
    username: { type: DataTypes.STRING },
    enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
})

const Passwords = sequelizePlatform.define('passwords', {
    password_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userid: { type: DataTypes.UUID },
    password: { type: DataTypes.STRING }
})

const Sessions = sequelizePlatform.define('sessions', {
    loginid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userid: { type: DataTypes.UUID },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    access_token: { type: DataTypes.STRING },
    refresh_token: { type: DataTypes.STRING },
    revoked: { type: DataTypes.BOOLEAN, defaultValue: false }
})

export {
    Users,
    Passwords,
    Sessions
}