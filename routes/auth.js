import { Router } from 'express'
const router = Router()

import validateAuth from '../middlewares/validateAuth.js'

import {
    login,
    logout,
    validate,
    getUserInfos
} from '../controllers/auth.js'

router.post('/login', login)
router.get('/logout', logout)

router.get('/validate', validateAuth, validate)
router.post('/user', getUserInfos)

export default router