// Annie Chen and Emily Zhu
"use strict";

// standard modules, loaded from node_modules
const path = require('path');
require("dotenv").config({ path: path.join(process.env.HOME, '.cs304env')});
const express = require('express');
const morgan = require('morgan');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const flash = require('express-flash');
const cookieSession = require('cookie-session');
const serveStatic = require('serve-static');

// our modules loaded from cwd

const { Connection } = require('./connection');
const cs304 = require('./cs304');

// Create and configure the app

const app = express();

// Morgan reports the final status code of a request's response
app.use(morgan('tiny'));

app.use(cs304.logStartRequest);

app.use(cs304.logRequestData);  // tell the user about any request data

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(flash());

app.use(serveStatic('public'));
app.set('view engine', 'ejs');

const mongoUri = cs304.getMongoUri();
const myDBName = "annemily";
// collection names
const USERS = "users";
const COURSES = "courses";
const REVIEWS = "reviews";

app.use(cookieSession({
  name: 'session',
  keys: [cs304.randomString(20)],
  expires: 0                  // expires when tab/browser closed
}));

const ROUNDS = 15;

const tagMap = {
    easyA: "Easy A",
    discussion: "Discussion-based",
    flipped: "Flipped classroom",
    "300": "300-level",
    reading: "Reading heavy",
    tests: "No tests"
};

// ================================================================

/**
 * Processes login form (using POST) with username and password fields
 * Handles any issues with loggin in
 * If successful, updates cookies and redirects to home page
 * If not, flashes error message and redirects to login page
 * @param {Request} req the request object
 * @param {Response} res the response object
 */
app.post("/login", async (req, res) => {
    try {
        const username = req.body.username;
        const password = req.body.password;
        const db = await Connection.open(mongoUri, myDBName);
        // check if username exists
        var existingUser = await db.collection(USERS).findOne({username: username});
        console.log('user', existingUser);
        // handles situations where login won't work
        if (!existingUser) {
            req.flash('error', "Username does not exist - try again.");
            return res.redirect('/login')
        }
        const match = await bcrypt.compare(password, existingUser.hash); 
        console.log('match', match);
        if (!match) {
            req.flash('error', "Username or password incorrect - try again.");
            return res.redirect('/login')
        }
        req.flash('info', 'successfully logged in as ' + username);
        // updating cookies if successful login
        req.session.user = existingUser;
        req.session.loggedIn = true;
        console.log('login as', username);
        return res.redirect('/');
    } catch (error) {
        req.flash('error', `Form submission error: ${error}`);
        return res.redirect('/login')
  }
});


/**
 * Processes registration form (using POST) with username, password, 
 * confirm password, email address, and class year fields.
 * Handles any issues with registering
 * If successful, updates cookies and redirects to home page
 * If not, flashes error message and redirects to register or login page
 * @param {Request} req the request object
 * @param {Response} res the response object
 */
app.post("/register", async (req, res) => {
    try {
        const username = req.body.username;
        const password = req.body.password;
        const db = await Connection.open(mongoUri, myDBName);
        var existingUser = await db.collection(USERS).findOne({username: username});
        // handles situations where registration won't work
        if (existingUser) {
            req.flash('error', "Username already exists - please try logging in instead.");
            return res.redirect('/login')
        }
        if (!checkWellesleyEmail(req.body.addr)) {
            req.flash('error', "Please use a Wellesley College email address.");
            return res.redirect('/register')
        }
        if (password != req.body.confirmPassword) {
            req.flash('error', "Passwords do not match - try again.");
            return res.redirect('/register')
        }
        const hash = await bcrypt.hash(password, ROUNDS);
        // create new user object and insert into database
        let newUser = {
            user_id: getUserID(req.body.addr),
            email: req.body.addr,
            username: username,
            hash: hash,
            role: "student",
            class_year: req.body.year
        };
        await db.collection(USERS).insertOne(newUser);
        console.log('successfully joined', username);
        req.flash('info', 'successfully joined and logged in as ' + username);
        // updating cookies if successful registration
        req.session.user = newUser;
        req.session.loggedIn = true;
        return res.redirect('/');
    } catch (error) {
        req.flash('error', `Form submission error: ${error}`);
        return res.redirect('/register')
    }
});


/**
 * Processes logout form (using POST)
 * If user is logged in, clears cookies and redirects to login page with success message
 * @param {Request} req the request object
 * @param {Response} res the response object
 */
app.post('/logout', (req,res) => {
    if (req.session.user) {
        // clear cookies
        req.session.user = null;
        req.session.loggedIn = false;
        req.flash('info', 'You are logged out');
        return res.redirect('/login');
    } else {
        req.flash('error', 'You are not logged in - please do so.');
        return res.redirect('/login');
    }
});


/**
 * Renders user's profile page, which includes basic information and
 * their submitted reviews.
 * Requires user to be logged in.
 * @param {Request} req the request object
 * @param {Response} res the response object
 */
app.get("/profile", requiresLogin, async (req, res) => {
    const db = await Connection.open(mongoUri, myDBName);
    const user = req.session.user;
    const reviews = await db.collection(REVIEWS)
        .find({ user_id: user.user_id })
        .sort({ submittedAt: -1 })
        .toArray();

    res.render("profile.ejs", {
        user,
        reviews,
        currentPage: "profile"
    });
});


/**
 * Renders the home page with an empty search result.
 * Requires user to be logged in.
 * @param {Request} req the request object
 * @param {Response} res the response object
 */
app.get("/", requiresLogin, (req, res) => {
    return res.render("index.ejs", {results: [], currentPage: "home"});
});


/**
 * Renders the login page.
 * @param {Request} req the request object
 * @param {Response} res the response object
 */
app.get("/login", (req, res) => {
    return res.render("login.ejs");
});


/**
 * Renders the register page.
 * @param {Request} req the request object
 * @param {Response} res the response object
 */
app.get("/register", (req, res) => {
    return res.render("register.ejs");
});


/**
 * Renders a specific course page with course details and reviews.
 * Requires user to be logged in.
 * If the course does not exist, flashes an error and redirects to home page.
 * @param {Request} req the request object
 * @param {Response} res the response object
 */
app.get("/course/:dept/:num", requiresLogin, async (req, res) => {
    try {
        const dept = req.params.dept.toUpperCase();
        const num = req.params.num;
        const db = await Connection.open(mongoUri, myDBName);

        // add call to helper to recalculate course statistics

        const courseData = await db.collection(COURSES).findOne({
            department: dept,
            course_num: num
        });
        if (!courseData) {
            req.flash('error', `Course ${dept}${num} not found.`);
            return res.redirect('/');
        }

        const reviews = await db.collection(REVIEWS)
            .find({ department: dept, course_num: num })
            .sort({ submittedAt: -1 })
            .toArray();

        res.render("course.ejs", {
            course: courseData,
            reviews: reviews,
            user: req.session.user,
            currentPage: "course"
        });
    } catch (error) {
        req.flash('error', `Loading course page error: ${error}`);
        return res.redirect('/');
    }
});


/**
 * Renders the upload page form with a dropdown menu of all courses
 * Requires user to be logged in
 * @param {Request} req the request object
 * @param {Response} res the response object
 */
app.get("/upload", requiresLogin, async(req, res) => {
    try {
        const db = await Connection.open(mongoUri, myDBName);

        const allCourses = await db.collection(COURSES).find().sort({ department: 1, course_num: 1 }).toArray();
        res.render("upload.ejs", {
            courses: allCourses,
            user: req.session.user,
            currentPage: "upload"
        });
    } catch (error) {
        req.flash('error', `Loading courses from database error: ${error}`);
        return res.redirect('/')
    }
})


/**
 * Processes user submitted coursereview form (using POST) and stores review 
 * in reviews database collection.
 * Updates reviews for user and course database collections.
 * Requires user to be logged in.
 * If successful, redirects to the course page with a success message.
 * If not, flashes error message and redirects to upload page.
 * @param {Request} req the request object
 * @param {Response} res the response object
 */
app.post("/upload", requiresLogin, async (req, res) => {
    try {
        const db = await Connection.open(mongoUri, myDBName);
        const [dept, num] = req.body.course.split("-");
        const newReview = {
            user_id: req.session.user.user_id,
            username: req.session.user.username,
            course_num: num,
            department: dept,
            hours: Number(req.body.hoursPerWeek || req.body["hours-per-week"]),
            difficulty: Number(req.body.difficulty),
            retake: req.body["yes-no"] === "yes",
            tags: req.body.tag
                ? (Array.isArray(req.body.tag) ? req.body.tag : [req.body.tag])
                : [],
            comments: req.body.comments,
            submittedAt: new Date()
        };

        // reviews
        const result = await db.collection(REVIEWS).insertOne(newReview);
        const reviewId = result.insertedId;

        // users
        await db.collection(USERS).updateOne(
            { user_id: req.session.user.user_id },
            { $push: { reviews: reviewId } }
        );

        // courses
        const prettyTags = newReview.tags.map(t => tagMap[t] || t);
        await db.collection(COURSES).updateOne(
            { department: dept, course_num: num },
            { 
                $push: { reviews: reviewId },
                $addToSet: { tags: { $each: prettyTags } }
            }
        );

        req.flash('info', "Thanks for the review!");
        res.redirect(`/course/${dept}/${num}`);
    } catch (error) {
        console.error(error);
        req.flash('error', `Upload course error: ${error}`);
        return res.redirect('/upload');
    }
});


/**
 * Processes form (GET) and searches database for courses matching the search term
 * @param {Request} req the request object
 * @param {Response} res the response object
 */
app.get("/search/", requiresLogin, async (req, res) => {
    let term = req.query.term;
    let tag = req.query.tag;

    const db = await Connection.open(mongoUri, myDBName);
    const courses = db.collection(COURSES);

    if (!tag) tag = [];
    else if (!Array.isArray(tag)) tag = [tag];

    tag = tag.map(t => tagMap[t]);
    
    let query = {};
    if (tag.length > 0) {
        query.tags = { $in: tag };
    }
    var regex = new RegExp(term, "i");
    query.searchTerm = regex;
    let results = await courses.find(query).toArray();
    return res.render("index.ejs", {results: results, currentPage: "home"});
});


/**
 * Flashes error message and redirects to login page if user not logged in
 * @param {Request} req the request object
 * @param {Response} res the response object
 * @param {Function} next the next function to call if user is logged in
 */
function requiresLogin(req, res, next) {
    if (!req.session.loggedIn) {
        req.flash('error', 'This page requires you to be logged in - please do so.');
        return res.redirect("/login");
    } else {
        next();
  } 
}


/**
 * Extracts the user ID from an email address
 * @param {String} email 
 * @returns {String} the user ID
 */
function getUserID(email) {
    let position = email.indexOf("@");
    if (position === -1) {
        return email;
    }
    // part before the @ is the user ID
    return email.substring(0, position);
} 


/**
 * Checks if an email address belongs to the Wellesley College domain
 * @param {String} email 
 * @returns {Boolean} true if the email is from Wellesley College, false otherwise
 */
function checkWellesleyEmail(email) {
    let position = email.indexOf("@");
    let domain = email.substring(position);
    if (position === -1) {
        return false;
    }
    // part after the @ should be @wellesley.edu
    return domain === "@wellesley.edu";
}

// ================================================================
// postlude

const serverPort = cs304.getPort(8080);

// this is last, because it never returns
app.listen(serverPort, function() {
    console.log(`listening on ${serverPort}`);
    console.log(`visit http://cs.wellesley.edu:${serverPort}/`);
    console.log(`or http://localhost:${serverPort}/`);
    console.log('^C to exit');
});
