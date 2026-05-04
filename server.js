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
const multer = require('multer');
const fs = require('fs').promises;
const { ObjectId } = require('mongodb');

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

app.use('/uploads', express.static('uploads'));

const mongoUri = cs304.getMongoUri();
const myDBName = "annemily";
// collection names
const USERS = "users";
const COURSES = "courses";
const REVIEWS = "reviews";
const FILES = 'files';

app.use(cookieSession({
  name: 'session',
  keys: [cs304.randomString(20)],
  expires: 0                  // expires when tab/browser closed
}));

const ROUNDS = 15;

/**
 * Creates a string of numbers based on current date 
 * @param {Date} dateObj
 * @returns String of time
 */
function timeString(dateObj) {
    if( !dateObj) {
        dateObj = new Date();
    }
    // convert val to two-digit string
    let d2 = (val) => val < 10 ? '0'+val : ''+val;
    let hh = d2(dateObj.getHours())
    let mm = d2(dateObj.getMinutes())
    let ss = d2(dateObj.getSeconds())
    return hh+mm+ss
}

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads')
  },
  filename: function (req, file, cb) {
      let parts = file.originalname.split('.');
      let ext = parts[parts.length-1];
      let hhmmss = timeString();
      cb(null, file.fieldname + '-' + hhmmss + '.' + ext);
  }
});

// 1024 * 1024 is around 1MB
var upload = multer({ storage: storage, limits: {fileSize: 1024 * 1024 }});

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
            class_year: req.body.year,
            bookmarked: []
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
 * Recalculates and updates statistics for a specific course based on reviews
 * @param {Object} db database connection
 * @param {string} dept department
 * @param {string} num course number
 */
async function updateCourseStats(db, dept, num) {
    const reviews = await db.collection(REVIEWS)
        .find({ department: dept, course_num: num })
        .toArray();

    if (reviews.length === 0) {
        return;
    }

    // get aggregate statistics
    let totalHours = 0;
    let totalDifficulty = 0;
    let retakeCount = 0;

    let tagSet = new Set();

    reviews.forEach(r => {
        totalHours += r.hours || 0;
        totalDifficulty += r.difficulty || 0;
        if (r.retake) retakeCount++;

        if (r.tags) {
            r.tags.forEach(t => {
                tagSet.add(t);
            });
        }
    });

    const avgHours = totalHours / reviews.length;
    const avgDifficulty = totalDifficulty / reviews.length;
    const retakeRate = (retakeCount / reviews.length) * 100;
    const prettyTags = Array.from(tagSet).map(t => tagMap[t] || t);

    // update course
    await db.collection(COURSES).updateOne(
        { department: dept, course_num: num },
        {
            $set: {
                avgHours: Number(avgHours.toFixed(1)),
                avgDifficulty: Number(avgDifficulty.toFixed(1)),
                retake: Number(retakeRate.toFixed(0)),
                tags: prettyTags
            }
        }
    );
}


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

        // call to helper to recalculate course statistics
        await updateCourseStats(db, dept, num);

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
        
        // finds most recenty added syllabus
        let syllabusTitle = dept+"-"+num+" Syllabus";
        let files = await db.collection(FILES)
            .find({title: syllabusTitle, submittedAt: {$exists: true}})
            .sort({submittedAt: -1})
            .limit(1)
            .toArray();
        
        // makes sure file is in uploads folder
        let fileSaved = true;
        try {
            await fs.access("."+files[0].path);
        } catch (err) {
            fileSaved = false;
        }
        
        // check if it's a saved course
        let saved = false;
        if (courseData.usersBookmarked.includes(req.session.user.username)) {
            saved = true;
        }

        // checks if already uploaded a review
        let userReviews = await db.collection(REVIEWS).find({
            username: req.session.user.username, course_num: num, department: dept
        }).toArray();

        res.render("course.ejs", {
            course: courseData,
            reviews: reviews,
            user: req.session.user,
            file: files[0],
            fileSaved: fileSaved,
            saved: saved,
            reviewID: userReviews[0] || null,
            currentPage: "course"
        });
    } catch (error) {
        req.flash('error', `Loading course page error: ${error}`);
        return res.redirect('/');
    }
});

/**
 * Renders the update review page form with the correct course
 * Requires user to be logged in
 * Only updates for valid review and correct user
 * @param {Request} req the request object
 * @param {Response} res the response object
 */
app.get("/update/:reviewID", requiresLogin, async(req, res) => {
    try {
        const db = await Connection.open(mongoUri, myDBName);
        let newReview = new ObjectId(req.params.reviewID);
        const review = await db.collection(REVIEWS).findOne({_id: newReview});
        if (review === null) {
            req.flash('error', "review does not exist");
            return res.redirect("/");
        }
        // only admin or user who made the review can edit/delete it
        if (req.session.user.username != review.username && req.session.user.role != "admin") {
            req.flash('error', "You can only edit your own reviews!");
            return res.redirect("/");
        }
        res.render("update.ejs", {
            review: review,
            user: req.session.user,
            currentPage: "update"
        }); 
    } catch (error) {
        req.flash('error', `Update course error: ${error}`);
        return res.redirect('/');
    }
});


/**
 * Processes form (POST) and updates review 
 * Requires user to be logged in
 * @param {Request} req - the request object
 * @param {Response} res - the response object
 */
app.post("/update/:reviewID", requiresLogin, upload.single('syllabus'), async (req, res) => {    
    try {
        console.log("BODY:", req.body); // debug purposes
        const db = await Connection.open(mongoUri, myDBName);
        let reviewId = new ObjectId(req.params.reviewID);

        // find review
        const review = await db.collection(REVIEWS).findOne({ _id: reviewId });
        if (!review) {
            req.flash('error', "Review does not exist.");
            return res.redirect("/");
        }

        if (req.session.user.username !== review.username && req.session.user.role !== "admin") {
            req.flash('error', "You can only edit your own reviews.");
            return res.redirect("/");
        }

        const submittedAt = new Date();

        // if user uploaded a file
        let newFile = null;
        if (req.file != null) {
            newFile = {
                title: review.department + "-" + review.course_num + " Syllabus",
                owner: req.session.user.username,
                path: '/uploads/'+req.file.filename,
                submittedAt: submittedAt
            }
            await db.collection(FILES).insertOne(newFile);
        }

        const updatedReview = {
            hours: Number(req.body.hoursPerWeek || req.body["hours-per-week"]),
            difficulty: Number(req.body.difficulty),
            retake: req.body["yes-no"] === "yes",
            tags: req.body.tag
                ? (Array.isArray(req.body.tag) ? req.body.tag : [req.body.tag])
                : [],
            comments: req.body.comments,
            submittedAt: submittedAt
        };

        // update review
        await db.collection(REVIEWS).updateOne(
            { _id: reviewId },
            { $set: updatedReview }
        );

        // aggregate statistics
        await updateCourseStats(db, review.department, review.course_num);

        req.flash('info', "Update successful.");
        return res.redirect(`/course/${review.department}/${review.course_num}`);
    } catch (error) {
        console.error(error);
        req.flash('error', `Update course error: ${error}`);
        return res.redirect('/');
    }
});

/**
 * Processes form (POST) and deletes review from database
 * Requires user to be logged in
 * redirects to home page after deletion
 * @param {Request} req - the request object
 * @param {Response} res - the response object
 */
app.post("/delete/:reviewID", requiresLogin, async (req, res) => {
    try {
        const db = await Connection.open(mongoUri, myDBName);
        let newReview = new ObjectId(req.params.reviewID);
        // removes from courses
        db.collection(COURSES).updateMany(
            {reviews: newReview },
            {$pull: {reviews: newReview}
        });
        // removes from users
        db.collection(USERS).updateMany(
            {reviews: newReview },
            {$pull: {reviews: newReview}
        });
        // removes from reviews
        await db.collection(REVIEWS).deleteOne({_id: newReview});
        // aggregate statistics
        await updateCourseStats(db, newReview.department, newReview.course_num);
        req.flash('info', "Review was deleted successfully");
        return res.redirect("/");
    }  
    catch (error) {
        console.error(error);
        req.flash('error', `Update course error: ${error}`);
        return res.redirect('/');
    }
});

/**
 * Renders the upload page course form with specified course
 * Requires user to be logged in
 * @param {Request} req the request object
 * @param {Response} res the response object
 */
app.get("/upload/:dept/:num", requiresLogin, async(req, res) => {
    try {
        const db = await Connection.open(mongoUri, myDBName);

        const course = await db.collection(COURSES)
        .findOne({department: req.params.dept, course_num: req.params.num});

        res.render("upload.ejs", {
            course: course,
            user: req.session.user,
            currentPage: "upload"
        });
    } catch (error) {
        req.flash('error', `Loading course from database error: ${error}`);
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
app.post("/upload/:dept/:num", requiresLogin, upload.single('syllabus'), async (req, res) => {
    try {
        const db = await Connection.open(mongoUri, myDBName);
        const dept = req.params.dept;
        const num = req.params.num;
        const course = dept + '-' + num;

        const submittedAt = new Date();

        // if user uploaded a file
        let newFile = null;
        if (req.file != null) {
            newFile = {
                title: course + " Syllabus",
                owner: req.session.user.username,
                path: '/uploads/'+req.file.filename,
                submittedAt: submittedAt
            }
            await db.collection(FILES).insertOne(newFile);
        }

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
            submittedAt: submittedAt
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
        await updateCourseStats(db, dept, num);

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
    let term = req.query.term || "";
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
 * Finds bookmarked courses and renders the bookmarks page
 * Requires user to be logged in
 * @param {Request} req the request object
 * @param {Response} res the response object
 */
app.get("/bookmarks", requiresLogin, async (req, res) => {
    const db = await Connection.open(mongoUri, myDBName);
    const courses = db.collection(COURSES);

    let username = req.session.user.username;
    let user = await db.collection(USERS).findOne({username: username});
    // changes strings to ObjectIds
    let bookmarks = user.bookmarked.map(bookmark => new ObjectId(bookmark));
    // finds courses that are in the user's bookmarked courses
    let results = await courses.find({_id: {$in: bookmarks}}).toArray();

    return res.render("bookmarks.ejs", {results: results, currentPage: "bookmarks"});
});

/**
 * Searches for course in the database
 * Bookmarks the course if it has not been bookmarked
 * by updating USERS and COURSES collections
 * Un-bookmarks if it has been bookmarked
 * @param {String} department the department
 * @param {String} course_num  the course number
 * @param {String} saved if the course needs to be saved
 * @returns a promise
 */
async function boomark(department, course_num, saved, username) {
    try {
        const db = await Connection.open(mongoUri, myDBName);
        const course = await db.collection(COURSES).findOne(
            {department: department, course_num: course_num}
        );
        // if currently unsaved, add bookmark
        if (saved === "save") {
            // adds course to user bookmarks
            await db.collection(USERS).updateOne(
                {username: username},
                {$addToSet: {bookmarked: course._id}},
                {upsert: false}
            );
            // adds user who bookmarked course to course
            await db.collection(COURSES).updateOne(
                {_id: course._id},
                {$addToSet: {usersBookmarked: username}},
                {upsert: false}
            );
        }
        // if currently saved, remove bookmark
        else {
            await db.collection(USERS).updateOne(
                {username: username},
                {$pull: {bookmarked: course._id}},
                {upsert: false}
            );
            await db.collection(COURSES).updateOne(
                {_id: course._id},
                {$pull: {usersBookmarked: username}},
                {upsert: false}
            );
        }
        return course;
    }
    catch (error) {
        console.error(error);
    }
}

/**
 * Updates database and returns data for frontend handler
 * @param {Request} req the request object
 * @param {Response} res the response object
 */
app.post('/saveAjax/:dept/:num/:act', requiresLogin, async (req,res) => {
    const course = await boomark(req.params.dept, req.params.num, req.params.act, req.session.user.username);
    return res.json({course: course, act: req.params.act});
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

app.use((err, req, res, next) => {
    console.log('error', err);
    if(err.code === 'LIMIT_FILE_SIZE') {
        console.log('file too big')
        req.flash('error', 'file too big')
        res.redirect('/')
    } else {
        console.error(err.stack)
        res.status(500).send('Something broke!')
    }
})

const serverPort = cs304.getPort(8080);

// this is last, because it never returns
app.listen(serverPort, function() {
    console.log(`listening on ${serverPort}`);
    console.log(`visit http://cs.wellesley.edu:${serverPort}/`);
    console.log(`or http://localhost:${serverPort}/`);
    console.log('^C to exit');
});
