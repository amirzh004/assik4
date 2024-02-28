const https = require('https');
const express = require("express");
const bodyParser = require("body-parser");
const session = require('express-session');
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const axios = require("axios");
const User = require('./models/User');
const multer = require('multer');
const path = require('path');
const Photo = require('./models/Photo');


const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({
    secret: '1234',
    resave: false,
    saveUninitialized: true
}));
app.set('view engine', 'ejs');

const dbUrl = "mongodb+srv://amirzhanmukhidinov572:5636nkC@cluster0.vl8mbol.mongodb.net/cars";
const connectionParams = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
};

mongoose.connect(dbUrl, connectionParams)
    .then(() => console.info("Connected to the database"))
    .catch((e) => console.log("Error connecting to the database", e));

app.get('/', async (req, res) => {
    try {
        const users = await User.find().exec();
        const usersWithImages = await Promise.all(users.map(async (user) => {
            const images = await Photo.find({ userId: user._id }).exec();
            return { user, images };
        }));

        res.render('index', { usersWithImages, userIsLoggedIn: req.session.user, error: null });
    } catch (error) {
        console.error('Error fetching users and images:', error);
        res.send('An error occurred while fetching users and images.');
    }
});

app.post('/save-photo', async (req, res) => {
    try {
        const { photoURL } = req.body;
        if (!req.session.user) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        const newPhoto = new Photo({
            userId: req.session.user._id,
            photoURL: photoURL
        });
        await newPhoto.save();
        res.redirect('/');
    } catch (error) {
        console.error('Error saving photo URL to MongoDB:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/save-photo-gallery', async (req, res) => {
    try {
        const { photoURL } = req.body;
        if (!req.session.user) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        const newPhoto = new Photo({
            userId: req.session.user._id,
            photoURL: photoURL
        });
        await newPhoto.save();
        res.redirect('/gallery');
    } catch (error) {
        console.error('Error saving photo URL to MongoDB:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


app.get("/search", function (req, res) {
    res.render("search", { userIsLoggedIn: req.session.user, error: null });
});

app.get("/editprofile", function (req, res) {
    res.render("editprofile", { userIsLoggedIn: req.session.user, error: null });
});

app.get("/login", function (req, res) {
    res.render("login", { error: null });
});

app.post("/login", async function (req, res) {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (user && !user.deletedAt && (await bcrypt.compare(password, user.password))) {
            req.session.user = { _id: user._id, email: user.email, username: user.username, isAdmin: user.isAdmin };

            if (user.isAdmin) {
                res.redirect("/admin");
            } else {
                res.redirect("/"); 
            }
        } else {
            res.render("login", { userIsLoggedIn: req.session.user, error: "Invalid username or password" });
        }
    } catch (error) {
        console.error("Error during login:", error);
        res.render("login", { error: "An error occurred. Please try again." });
    }
});

app.get("/registration", function (req, res) {
    res.render("registration", { userIsLoggedIn: req.session.user, error: null });
});

app.post("/registration", async function (req, res) { 
    const { email, username, password } = req.body; 

    try { 
        const hashedPassword = await bcrypt.hash(password, 10); 
        const newUser = new User({ email, username, password: hashedPassword }); 
        await newUser.save(); 

        res.redirect("/login"); 
    } catch (error) { 
        console.error("Error during registration:", error); 
        res.render("registration", { error: "An error occurred. Please try again." }); 
    } 
});

app.get("/admin", async function (req, res) {
    try {
        const users = await User.find({});
        res.render("admin", { users, userIsLoggedIn: req.session.user });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.send("An error occurred while fetching user data.");
    }
});

app.get("/admin/add", function (req, res) {
    res.render("addUser", { userIsLoggedIn: req.session.user });
});

app.post("/admin/add", async function (req, res) {
    const { email, username, password, isAdmin } = req.body;

    try {
        const isAdminValue = isAdmin === 'true';

        const newUser = new User({
            email,
            username,
            password: await bcrypt.hash(password, 10), 
            isAdmin: isAdminValue,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        await newUser.save();

        res.redirect("/admin");
    } catch (error) {
        console.error("Error adding user:", error);
        res.send("An error occurred while adding user.");
    }
});

app.post("/admin/edit/:userId", async function (req, res) {
    const userId = req.params.userId;
    const { email, username, newPassword, isAdmin } = req.body;

    try {
        const updateObject = {
            email,
            username,
            updatedAt: Date.now(),
            isAdmin: isAdmin === 'true',
        };

        if (newPassword) {
            updateObject.password = await bcrypt.hash(newPassword, 10);
        }

        await User.findByIdAndUpdate(userId, updateObject);

        res.redirect("/admin");
    } catch (error) {
        console.error("Error updating user:", error);
        res.send("An error occurred while updating user.");
    }
});

app.get("/admin/edit/:userId", async function (req, res) {
    const userId = req.params.userId;

    try {
        const user = await User.findById(userId);
        res.render("editUser", { user, userIsLoggedIn: req.session.user  });
    } catch (error) {
        console.error("Error fetching user for edit:", error);
        res.send("An error occurred while fetching user data for edit.");
    }
});

app.post("/admin/delete/:userId", async function (req, res) {
    const userId = req.params.userId;

    try {
        await User.findByIdAndUpdate(userId, { deletedAt: Date.now() });

        res.redirect("/admin");
    } catch (error) {
        console.error("Error deleting user:", error);
        res.send("An error occurred while deleting user.");
    }
});

app.get("/logout", function (req, res) {
    req.session.destroy();
    res.redirect("/");
});

app.get("/editprofile", function (req, res) {
    res.render("editprofile", { userIsLoggedIn: req.session.user, error: null });
});

app.post("/editprofile/:userId", async function (req, res) {
    const userId = req.params.userId; 
    const { email, username, password } = req.body; 
    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).send("User not found");
        }

        user.email = email;
        user.username = username;
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            user.password = hashedPassword;
        }

        await user.save();

        req.session.user = { _id: user._id, email: user.email, username: user.username, isAdmin: user.isAdmin };

        res.redirect("/profile");
    } catch (error) {
        console.error("Error updating user profile:", error);
        res.render("editprofile", { userIsLoggedIn: req.session.user, error: "An error occurred. Please try again." });
    }
});

app.post("/search", async function (req, res) {
    const vin = req.body.vin;

    const options = {
        method: 'GET',
        url: 'https://vin-decoder19.p.rapidapi.com/vin_decoder_extended',
        params: {
            vin: vin
        },
        headers: {
            'X-RapidAPI-Key': 'b666135112msh258fecf98b8f0b5p1f8eeajsn15ddaa3603bf',
            'X-RapidAPI-Host': 'vin-decoder19.p.rapidapi.com'
        }
    };

    try {
        const response = await axios.request(options);
        console.log(response.data);
        res.render("search", { userIsLoggedIn: req.session.user, error: null, decodedData: response.data });
        
    } catch (error) {
        console.error(error);
        res.render("search", { userIsLoggedIn: req.session.user, error: "An error occurred while decoding the VIN", decodedData: null });
    }
});

function fetchCarImages() {
    const accessKey = '3imTApXIIJ4ftLi0FiX047sO2r3Exg9YHr-rPZT17_E';
    const query = 'cars';
    const url = `https://api.unsplash.com/search/photos?query=${query}&client_id=${accessKey}`;

    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            let data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });
            response.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    resolve(parsedData.results);
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

app.get('/gallery', async (req, res) => {
    try {
        const carImages = await fetchCarImages();
        res.render('gallery', { userIsLoggedIn: req.session.user, carImages });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('Internal Server Error');
    }
});

const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function(req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// Multer file filter
function checkFileType(file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Error: Images only!');
    }
}

// Multer upload configuration
const upload = multer({
    storage: storage,
    limits: { fileSize: 1000000 },
    fileFilter: function(req, file, cb) {
        checkFileType(file, cb);
    }
}).single('myImage');

// Profile route handler
app.get('/profile', async (req, res) => {
    try {
        const galleryImages = await Photo.find({ userId: req.session.user._id });
        let msg = '';
        let file = '';

        if (req.session.msg) {
            msg = req.session.msg;
            delete req.session.msg; 
        }
        if (req.session.file) {
            file = req.session.file;
            delete req.session.file; 
        }

        res.render('profile', { userIsLoggedIn: req.session.user, galleryImages, msg, file });
    } catch (error) {
        console.error('Error fetching user\'s images:', error);
        res.send('An error occurred while fetching user\'s images.');
    }
});

// Upload route handler
app.post("/upload", (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            req.session.msg = err;
            res.redirect('/profile');
        } else {
            if (req.file == undefined) {
                req.session.msg = 'Error: No File Selected!';
                res.redirect('/profile');
            } else {
                try {
                    const newPhoto = new Photo({
                        userId: req.session.user._id,
                        photoURL: `/uploads/${req.file.filename}`
                    });
                    await newPhoto.save();

                    req.session.msg = 'File Uploaded!';
                    req.session.file = `/uploads/${req.file.filename}`;
                    res.redirect('/profile');
                } catch (error) {
                    console.error("Error saving photo URL to MongoDB:", error);
                    req.session.msg = 'Error: Failed to save photo URL to database';
                    res.redirect('/profile');
                }
            }
        }
    });
});

app.listen(3000, function () {
    console.log("Server is running on port 3000");
});
