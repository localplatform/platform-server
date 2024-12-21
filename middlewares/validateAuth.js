import jwt from 'jsonwebtoken'
import * as Models from '../sql/models.js'

function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JSON_TOKEN_KEY)
        return {
            decoded: decoded,
            validated: true
        }
    } catch (error) {
        return {
            error: error,
            validated: false
        }
    }
}

const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    domain: '.mynetwk.biz'
}

export default async function validateAuth(req, res, next) {

    console.log('Request received')
    
    try {
        const token = req.cookies['token']
        const verificationResult = verifyToken(token)

        // Si le token est invalide (mais pas expiré)
        if (!verificationResult.validated && verificationResult.error.name !== 'TokenExpiredError') {
            console.log('error validating auth')
            return res.status(401).json({ error: 'Unauthorized, invalid token' })
        }

        // Chercher la session correspondante au token
        const existingSession = await Models.Sessions.findOne({
            where: { access_token: token }
        })

        if (!existingSession || existingSession.revoked) {
            return res.status(401).json({ error: 'Unauthorized, no session or session revoked' })
        }

        // Si le token a expiré, vérifier le refresh token
        if (verificationResult.error && verificationResult.error.name === 'TokenExpiredError') {
            // Vérifier si le refresh token est également expiré
            try {
                jwt.verify(existingSession.refresh_token, process.env.JSON_TOKEN_KEY)
            } catch (error) {
                if (error.name === 'TokenExpiredError') {
                    return res.status(401).json({ error: 'Unauthorized, refresh token expired' })
                }
            }

            // Si le refresh token est toujours valide, générer de nouveaux tokens
            const newAccessToken = generateToken(existingSession.userid, '1h')
            const newRefreshToken = generateToken(existingSession.userid, '7d')

            // Mettre à jour la session avec les nouveaux tokens
            await Models.Sessions.update(
                { access_token: newAccessToken, refresh_token: newRefreshToken },
                { where: { loginid: existingSession.loginid } }
            )

            // Envoyer le nouveau access token au client
            res.cookie('token', newAccessToken, cookieOptions)
        }

        // Si l'access token est valide, continuer sans renvoyer de réponse spécifique
        return next()

    } catch (error) {
        res.status(401).json({ message: "Erreur de validation", error })
    }
}