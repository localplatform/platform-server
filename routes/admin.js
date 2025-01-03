import { Router } from 'express'
const router = Router()

import {
    RemoveEnvironment,
    GetEnvironments,
    CreateEnvironment,
    GetEnvironment,
    GetTables,
    CreateTable,
    GetColumns,
    CreateColumn,
    UpdateEnvironment,
    GetTable,
    GetColumn,
    RemoveTable,
    UpdateTable,
    UpdateColumn,
    RemoveColumn,
    GetServers,
} from '../controllers/config.js'

router.get('/servers', GetServers)

router.get('/environments', GetEnvironments)
router.get('/environments/:id', GetEnvironment)
router.post('/environments', CreateEnvironment)
router.patch('/environments/:id', UpdateEnvironment)
router.delete('/environments/:environment', RemoveEnvironment)

router.get('/:environment/tables', GetTables)
router.get('/:environment/:table', GetTable)
router.post('/:environment', CreateTable)
router.patch('/:environment/:table', UpdateTable)
router.delete('/:environment/:table', RemoveTable)

router.get('/:environment/:table/columns', GetColumns)
router.get('/:environment/:table/:column', GetColumn)
router.post('/:environment/:table', CreateColumn)
router.patch('/:environment/:table/:column', UpdateColumn)
router.delete('/:environment/:table/:column', RemoveColumn)

export default router