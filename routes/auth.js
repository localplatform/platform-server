import { Router } from 'express'
const router = Router()

import {
    login,
    logout,
    validate,
    getUserInfos
} from '../controllers/auth.js'

router.post('/login', login)
router.get('/logout', logout)

router.get('/validate', validate)
router.post('/user', getUserInfos)

export default router