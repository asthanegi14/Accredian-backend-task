require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwtToken = require('jsonwebtoken');

const prisma = new PrismaClient();
const app = express();

const corsOptions = {
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await prisma.user.findUnique({
            where: { email: email },
        });

        if (!user) {
            console.log("This email is not registered");
            return res.status(400).json({ error: 'This email is not registered' });
        }

        if (!password) {
            console.log("Password not provided");
            return res.status(400).json({ error: 'Password not provided' });
        }

        const passMatch = await bcrypt.compare(password, user.password);

        if (user && passMatch) {
            const myToken = jwtToken.sign(
                {
                    name: user.name,
                    email: user.email,
                },
                process.env.privateKey,
                { expiresIn: '1d' }
            );
            console.log("logged in");

            return res.status(200).json({
                msg: 'Login successfully',
                name: user.name,
                email: user.email,
                token: myToken,
            });
        }

        console.log("Wrong Password");
        return res.status(400).json({ error: 'Wrong Password' });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Error occurred' });
    }
});

app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    console.log('Registering user...');

    try {
        const isValidEmail = await prisma.user.findUnique({
            where: { email: email },
        });
        const isValidUsername = await prisma.user.findFirst({
            where: { name: name },
        });

        if (isValidUsername) {
            console.log('Username already exists, please try another username.');
            return res.json('Username already exists, please try another username.');
        }
        if (isValidEmail) {
            console.log('User with this email already exists');
            return res.json('User with this email already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                email: email,
                name: name,
                password: hashedPassword,
            },
        });

        console.log('Registered');
        return res.json('Registered successfully');
    } catch (e) {
        console.error('Error:', e);
        return res.json('Error occurred');
    }
});

app.post('/referrals', async (req, res) => {
    const { name, referenceBonus, refereeBonus, email } = req.body;

    if (!name || !referenceBonus || !refereeBonus || !email) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const referral = await prisma.referral.create({
            data: {
                name,
                referenceBonus,
                refereeBonus,
                email,
            },
        });

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.Email,
                pass: process.env.EmailPassword,
            },
        });

        const mailOptions = {
            from: process.env.Email,
            to: email,
            subject: 'Referral Confirmation',
            text: `Hi ${name},\n\nThank you for your referral. You will receive a bonus of ${referenceBonus} and your referee will receive a bonus of ${refereeBonus}.\n\nBest regards,\nYour Company`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Failed to send email', error);
                return res.status(500).json({ error: 'Failed to send email' });
            }
            res.status(201).json({ referral });
        });
    } catch (error) {
        console.log('Internal server error = ', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/getReferrals', async (req, res) => {
    try {
        const { filter } = req.body;

        if (filter && filter !== 'All Programs') {
            const referrals = await prisma.referral.findMany({
                where: {
                    name: filter
                },
                select: {
                    name: true,
                    referenceBonus: true,
                    refereeBonus: true,
                },
            });
            console.log("Referrals:", referrals);
            res.json(referrals);
        } else {
            const referrals = await prisma.referral.findMany();
            console.log("Referrals:", referrals);
            res.json(referrals);
        }

    } catch (error) {
        console.error('Error fetching referrals:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
