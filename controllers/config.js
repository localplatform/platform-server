import runSql from '../sql/runSql.js'
import underscorestring from 'underscore.string'
const { slugify, underscored } = underscorestring

function NamifyString(string) {
    string = slugify(string)
    return underscored(string)
}
const environmentFunctions = {
    checkAvailability: async (environment) => {
        const env = await runSql(`SELECT * FROM [dataverse].[dbo].[environments] WHERE id = '${environment}'`)
        if (env.length === 1) {
            if (env[0].ready) {
                return true
            } else {
                await new Promise((resolve) => setTimeout(resolve, 250))
                return environmentFunctions.checkAvailability(environment)
            }
        } else { return false }
    },
    setStatus: async (name, status) => { }
}
const dataTypeMappings = {
    'STRING': 'nvarchar(MAX)',
    'INTEGER': 'int',
    'DECIMAL': 'decimal(20,10)',
    'DATE': 'datetime',
    'UUID': 'uniqueidentifier',
    'BOOLEAN': 'bit',
    'CHOICE': 'nvarchar(MAX)'
}
const baseFunctions = {
    SetEnvironmentsTypes: async (id) => {
        const new_environments_identifiers = [
            `${id}_DEV`,
            `${id}_ACC`,
            `${id}_PROD`
        ]
        return { new_environments_identifiers }
    },
    RemoveEnvironment: async (id) => {
        await runSql(`
            USE master; -- pass to the master database

            ALTER DATABASE ${id}
            SET SINGLE_USER -- this will disconnect all other connections
            WITH ROLLBACK IMMEDIATE; -- this will rollback any transaction which is running on that database

            DROP DATABASE ${id};
        `)
    },
    PrepareEnvironment: async (id) => {
        await runSql(`CREATE DATABASE "${id}"`)
        await runSql(`
            CREATE TABLE "${id}".dbo.env_tables
            (
                id uniqueidentifier DEFAULT NEWID() NOT NULL,
                CONSTRAINT PK_env_tables_id PRIMARY KEY CLUSTERED (id),
                name nvarchar(255),
                displayname nvarchar(255)
            );

            CREATE TABLE "${id}".dbo.env_columns
            (
                id INT IDENTITY(1,1) NOT NULL,
                CONSTRAINT PK_env_columns_id PRIMARY KEY CLUSTERED (id),
                name varchar(255),
                displayname nvarchar(255),
                datatype nvarchar(100),
                required bit,
                tablename varchar(255),
                managed bit,
                fieldvalues nvarchar(MAX)
            );
        `)
    }
}

async function PublishCustomizations() {
    /*let allModels = []

    const environments = await runSql(`SELECT * FROM [dataverse].[dbo].[environments]`)

    for (const env of environments) {

        const tables = await runSql(`SELECT * FROM ${env.name}.dbo.env_tables`)

        for (const table of tables) {

            const columns = await runSql(`SELECT * FROM ${env.name}.dbo.env_columns WHERE tablename = '${table.name}'`)

            allModels.push({
                name: table.name,
                displayname: table.displayname,
                environment: env.name,
                columns: columns
            })
        }
    }

    await fetch('http://localhost:4001/config/update_server', {
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            environments: environments,
            allTables: allModels
        })
    })*/
}
async function BackupEnvironment(environment_name) {

    let schema = {}
    let data = {}

    schema.environment = await runSql(`SELECT * FROM [dataverse].[dbo].[environments] WHERE name = '${environment_name}'`)
    schema.tables = await runSql(`SELECT * FROM [${environment_name}].[dbo].[env_tables]`)
    schema.columns = await runSql(`SELECT * FROM [${environment_name}].[dbo].[env_columns]`)

    for (const table of schema.tables) {

        data[`${table.name}`] = await runSql(`SELECT * FROM [${environment_name}].[dbo].[${table.name}]`)
    }

    return ({ schema, data })
}
export async function DeployEnvironment(req, res) {
    const { environment_name } = req.params

    const selectedMigrationGroup = await runSql(`
        SELECT TOP 1 FROM DEV_${environment_name}.dbo.migrations
        WHERE is_deployed = 'false'
    `)

    if (selectedMigrationGroup.length === 1) {
        const { schema: prodSchema, data: prodData } = await BackupEnvironment(environment_name)

        await runSql(`
            INSERT INTO DEV_${newname}.dbo.migrations
            (date, deployed_schema)
            VALUES ()
        `)
    } else {
        res.status(400).send({ error: 'Aucune mise à jour à effectuer en production' })
    }


    await baseFunctions.RemoveEnvironment()
}
export async function RestoreEnvironmentVersion() {

}


export async function GetEnvironments(req, res) {
    const data = await runSql(`SELECT * FROM [dataverse].[dbo].[environments]`)
    res.status(200).send(data)
}
export async function GetEnvironment(req, res) {
    const data = await runSql(`
        SELECT * FROM [dataverse].[dbo].[environments]
        WHERE id = '${req.params.id}'
    `)
    res.status(200).send(data[0])
}
export async function UpdateEnvironment(req, res) {
    const { display_name, target_environment } = req.body

    const newName = NamifyString(display_name)

    await runSql(`
        UPDATE [dataverse].[dbo].[environments]
        SET display_name = '${display_name}', name = '${newName}'
        WHERE name = '${target_environment}';

        ALTER DATABASE ${target_environment} SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        ALTER DATABASE ${target_environment} MODIFY NAME = ${newName};
        ALTER DATABASE ${newName} SET MULTI_USER;
    `)

    PublishCustomizations()
    res.status(200).send({ new_name: newName })
}
export async function CreateEnvironment(req, res) {
    const { display_name } = req.body
    const newname = NamifyString(display_name)

    if ((await runSql(`SELECT * FROM [dataverse].[dbo].[environments] WHERE name = '${newname}'`)).length === 1) {
        res.status(400).send({ error: `L'environnement existe déjà` })
    } else {

        console.log('Creating environment')

        const result = await runSql(`
            INSERT INTO dataverse.dbo.environments
            (display_name, name, ready)
            OUTPUT INSERTED.id AS EnvironmentId
            VALUES ('${display_name}', '${newname}', 1);
        `)

        const EnvironmentId = result[0]?.EnvironmentId


        const { new_environments_identifiers } = await baseFunctions.SetEnvironmentsTypes(EnvironmentId)
        for (const id of new_environments_identifiers) {
            await baseFunctions.PrepareEnvironment(id)
            console.log('Created environment - ', id)
        }

        await runSql(`
            CREATE TABLE "${EnvironmentId}_DEV".dbo.solutions
            (
                id uniqueidentifier DEFAULT NEWID() NOT NULL,
                CONSTRAINT PK_env_solution_id PRIMARY KEY CLUSTERED (id),
                name nvarchar(255)
            );
        `)

        await runSql(`
            CREATE TABLE "${EnvironmentId}_DEV".dbo.solutions_objects
            (
                id uniqueidentifier DEFAULT NEWID() NOT NULL,
                CONSTRAINT PK_env_solution_object_id PRIMARY KEY CLUSTERED (id),
                solutionid uniqueidentifier,
                name nvarchar(255)
            );
        `)
        
        console.log('New environment created - ', display_name, ' - ', EnvironmentId)
        res.status(201).send()
    }
}
export async function RemoveEnvironment(req, res) {
    const { environment } = req.params

    if (await environmentFunctions.checkAvailability(environment) === false) {
        res.status(400).json({ error: `L'environnement n'existe pas` })
    } else {

        const environments_names = await baseFunctions.SetEnvironmentsTypes(environment)

        for (const environment_name of environments_names.value) {
            await baseFunctions.RemoveEnvironment(environment_name)
            console.log('Removed environment - ', environment_name)
        }

        await runSql(`DELETE FROM [dataverse].[dbo].[environments] WHERE name = '${environment}'`)
        await PublishCustomizations()
        res.send()
    }
}

export async function GetTables(req, res) {
    const { environment } = req.params

    const selectedEnvironment = await runSql(`SELECT * FROM [dataverse].[dbo].[environments] WHERE id = '${environment}'`)

    if (selectedEnvironment.length === 1) {
        if (await environmentFunctions.checkAvailability(environment) === false) {
            res.status(400).json({ error: `L'environnement n'est pas disponible` })
        } else {
            const allTables = await runSql(`SELECT * FROM "${environment}_DEV".dbo.env_tables`)
            res.status(200).send(allTables)
        }
    } else {
        res.status(400).send({ error: 'Environnement introuvable' })
    }
}
export async function GetTable(req, res) {
    const { environment, table } = req.params

    const data = await runSql(`
        SELECT * FROM [DEV_${environment}].[dbo].[env_tables]
        WHERE name = '${table}'
    `)
    res.status(200).send(data[0])
}
export async function CreateTable(req, res) {
    const { environment } = req.params
    const { displayname } = req.body
    const newname = NamifyString(displayname)

    const selectedEnvironment = await runSql(`SELECT * FROM [dataverse].[dbo].[environments] WHERE name = '${environment}'`)

    if (selectedEnvironment.length === 1) {
        if (await environmentFunctions.checkAvailability(environment) === false) {
            res.status(400).json({ error: `L'environnement n'existe pas` })
        } else {
            if ((await runSql(`SELECT * FROM "${environment}_DEV".dbo.env_tables WHERE id = '${newname}'`)).length === 1) {
                res.status(500).json({ error: `La table existe déjà` })
            } else {
                const result = await runSql(`
                    INSERT INTO "${environment}_DEV".dbo.env_tables
                    (displayname, name)
                    OUTPUT INSERTED.id AS TableId
                    VALUES ('${displayname}', '${newname}');
                `)
        
                const tableId = result[0]?.TableId

                await runSql(`
                    CREATE TABLE "${environment}_DEV".dbo.${tableId}
                    (
                        id uniqueidentifier NOT NULL,
                        CONSTRAINT PK_${newname}_id PRIMARY KEY CLUSTERED (id),
                        createdon nvarchar(255),
                        modifiedon nvarchar(255),
                        createdby nvarchar(255),
                        modifiedby nvarchar(255)
                    );

                    INSERT INTO "${environment}_DEV".dbo.env_columns
                    (name, displayname, datatype, required, tablename, managed)
                    VALUES
                    ('createdon', 'Créé le', 'DATE', 1, '${newname}', 1),
                    ('modifiedon', 'Modifié le', 'DATE', 1, '${newname}', 1),
                    ('createdby', 'Créé par', 'STRING', 1, '${newname}', 1),
                    ('modifiedby', 'Modifié par', 'STRING', 1, '${newname}', 1);
                `)


                await PublishCustomizations()
                res.status(201).json({ message: `La table a été créée` })
            }
        }
    } else {
        res.status(400).send({ error: 'Environnement introuvable' })
    }
}
export async function UpdateTable(req, res) {
    const { environment, table } = req.params
    const { displayname } = req.body

    const newName = NamifyString(displayname)

    await runSql(`
        UPDATE [DEV_${environment}].[dbo].[env_tables]
        SET displayname = '${displayname}', name = '${newName}'
        WHERE name = '${table}';

        UPDATE [DEV_${environment}].[dbo].[env_columns]
        SET tablename = '${newName}'
        WHERE tablename = '${table}';

        USE DEV_${environment};
        EXEC sp_rename '${table}', '${newName}'; 
    `)

    await PublishCustomizations()
    res.send({ new_name: newName })
}
export async function RemoveTable(req, res) {
    const { environment, table } = req.params

    if (await environmentFunctions.checkAvailability(environment) === false) {
        res.status(400).json({ error: `L'environnement n'existe pas` })
    } else {
        await runSql(`
            DROP TABLE DEV_${environment}.dbo.${table};
            DELETE FROM [DEV_${environment}].[dbo].[env_tables] WHERE name = '${table}';
            DELETE FROM [DEV_${environment}].[dbo].[env_columns] WHERE tablename = '${table}';
        `)
        await PublishCustomizations()
        res.send()
    }
}

export async function GetColumn(req, res) {
    const { environment, table, column } = req.params

    const data = await runSql(`
        SELECT * FROM DEV_${environment}.dbo.env_columns
        WHERE tablename = '${table}' AND name = '${column}'
    `)

    res.status(200).json(data[0])
}
export async function GetColumns(req, res) {
    const { environment, table } = req.params

    const data = await runSql(`
        SELECT [name],[displayname],[datatype],[required] FROM DEV_${environment}.dbo.env_columns
        WHERE tablename = '${table}'
    `)
    res.status(200).json(data)
}
export async function CreateColumn(req, res) {
    const { environment, table } = req.params
    const values = req.body
    const newname = NamifyString(values.displayname)

    try {
        await runSql(`
            ALTER TABLE DEV_${environment}.dbo.${table}
            ADD ${newname} ${dataTypeMappings[values.datatype]}
    
            INSERT INTO DEV_${environment}.dbo.env_columns
            (name, displayname, datatype, required, tablename, managed)
            VALUES
            (
                '${newname}',
                '${values.displayname}',
                '${values.datatype}',
                '${values.required}',
                '${table}',
                0
            )
        `)
        await PublishCustomizations()
        res.status(201).send()
    } catch (error) {
        res.status(400).send(error)
    }
}
export async function UpdateColumn(req, res) {
    const { environment, table, column } = req.params
    const { displayname, required } = req.body

    const newName = NamifyString(displayname)

    await runSql(`
        UPDATE [DEV_${environment}].[dbo].[env_columns]
        SET displayname = '${displayname}', name = '${newName}', required = '${required}'
        WHERE tablename = '${table}' AND name = '${column}';

        USE DEV_${environment};
        EXEC sp_rename '${table}.${column}', '${newName}', 'COLUMN';   
    `)

    await PublishCustomizations()
    res.send()
}
export async function RemoveColumn(req, res) {
    const { environment, table, column } = req.params

    await runSql(`
        DELETE FROM [DEV_${environment}].[dbo].[env_columns] WHERE tablename = '${table}' AND name = '${column}';

        ALTER TABLE DEV_${environment}.dbo.${table} DROP COLUMN ${column};
    `)

    res.send()
}