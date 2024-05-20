import axios from "axios"

export default async function validateAuth(req, res, next) {
    try {
        const response = await axios.get('https://dev-auth-api.mynetwk.biz/auth/validate', {
            headers: {
                Cookie: `token=${req.cookies.token}`
            }
        })
        if (response.status === 200) {
            next()
        }
    } catch (error) {
        res.status(401).json({ message: "Erreur de validation" })
    }
}