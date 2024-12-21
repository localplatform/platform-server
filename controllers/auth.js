import * as Models from '../sql/models.js'
import * as bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

function generateToken(_userId, _expiresIn) {
    return jwt.sign(
        { userId: _userId },
        process.env.JSON_TOKEN_KEY,
        { expiresIn: _expiresIn }
    )
}

const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    domain: '.mynetwk.biz'
}

async function addUser(req, res) {
    bcrypt.hash(req.body.password, 12)
        .then(hash => {
            const user = new User({
                email: req.body.email,
                password: hash
            })
            user.save()
                .then(() => res.status(201).json({ message: 'Utilisateur créé !' }))
                .catch(error => res.status(400).json({ error }))
        })
        .catch(error => res.status(500).json({ error }))
}

async function login(req, res) {
    try {
        const { username, password } = req.body
        const selected_user = await Models.Users.findOne({
            where: { username: username }
        })

        if (!selected_user) {
            return res.status(401).json({
                error: 'User not found',
                errorCode: 'AUTH1'
            })
        }

        const storedPassword = await Models.Passwords.findOne({
            where: { userid: selected_user.userid }
        })

        const passwordValidated = await bcrypt.compare(password, storedPassword.password)
        if (!passwordValidated) {
            return res.status(401).json({
                error: 'Incorrect password',
                errorCode: 'AUTH2'
            })
        }

        // Rechercher une session existante pour l'utilisateur
        const existingSession = await Models.Sessions.findOne({
            where: { userid: selected_user.userid }
        })

        let accessToken, refreshToken

        if (existingSession && !existingSession.revoked) {
            // Si une session valide existe, rafraîchissez les tokens sans créer une nouvelle session
            accessToken = generateToken(selected_user.userid, '1h')
            refreshToken = generateToken(selected_user.userid, '7d')

            // Mettre à jour la session existante avec les nouveaux tokens
            await Models.Sessions.update(
                { access_token: accessToken, refresh_token: refreshToken },
                { where: { userid: selected_user.userid } }
            )
        } else {
            // Aucune session existante valide, créer une nouvelle session
            accessToken = generateToken(selected_user.userid, '1h')
            refreshToken = generateToken(selected_user.userid, '7d')

            // Créer une nouvelle session
            await Models.Sessions.create({
                userid: selected_user.userid,
                access_token: accessToken,
                refresh_token: refreshToken
            })
        }

        // Envoyer le token d'accès au client
        res.cookie('token', accessToken, cookieOptions)
        res.status(200).send('OK')
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: error })
    }
}
async function logout(req, res) {
    try {
        const token = req.cookies['token']

        if (token) {
            // Chercher la session correspondante au token
            await Models.Sessions.destroy({
                where: { access_token: token }
            })

            // Supprimer le cookie côté client
            res.cookie('token', '', {
                httpOnly: true,
                secure: true,
                sameSite: 'Strict',
                domain: '.mynetwk.biz',
                expires: new Date(0)
            })

            return res.status(200).json('Logout successful')
        }
        res.status(400).json(`No token provided`)
    } catch (error) {
        res.status(500).json(`Logout not completed, internal server error: ${error}`)
    }
}

async function validate(req, res) {
    res.status(200).json({ message: 'Access Token is valid' })
}
async function getUserInfos(req, res) {
    // try {
    //     const token = req.headers.authorization.split(' ')[1]
    //     const decodedToken = jwt.verify(token, process.env.JSON_TOKEN_KEY)
    //     const userId = decodedToken.userId

    //     const selected_user = await Models.Users.findOne({
    //         where: { userId: userId },
    //         attributes: [
    //             'firstname',
    //             'lastname',
    //             'username'
    //         ]
    //     })

    //     if (!selected_user) {
    //         return res.status(404).json({ error: 'User not found' })
    //     }

    //     res.status(200).json({
    //         userId: selected_user.userId,
    //         email: selected_user.email,
    //     })
    // } catch (error) {
    //     res.status(500).json({ error: 'Internal Server Error' })
    // }
}

export {
    login,
    logout,
    validate,
    getUserInfos
}