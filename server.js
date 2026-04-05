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

// ================================================================

// handles logging in and any related issues
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
            return res.redirect('/login-page')
        }
        const match = await bcrypt.compare(password, existingUser.hash); 
        console.log('match', match);
        if (!match) {
            req.flash('error', "Username or password incorrect - try again.");
            return res.redirect('/login-page')
        }
        req.flash('info', 'successfully logged in as ' + username);
        // updating cookies if successful login
        req.session.user = existingUser;
        req.session.loggedIn = true;
        console.log('login as', username);
        return res.redirect('/');
    } catch (error) {
        req.flash('error', `Form submission error: ${error}`);
        return res.redirect('/login-page')
  }
});

// handles registering the account and related issues
app.post("/register", async (req, res) => {
    try {
        const username = req.body.username;
        const password = req.body.password;
        const db = await Connection.open(mongoUri, myDBName);
        var existingUser = await db.collection(USERS).findOne({username: username});
        // handles situations where registration won't work
        if (existingUser) {
            req.flash('error', "Username already exists - please try logging in instead.");
            return res.redirect('/login-page')
        }
        if (!checkWellesleyEmail(req.body.addr)) {
            req.flash('error', "Please use a Wellesley College email address.");
            return res.redirect('/register-page')
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
        console.log('successfully joined', username, password, hash);
        req.flash('info', 'successfully joined and logged in as ' + username);
        // updating cookies if successful registration
        req.session.user = newUser;
        req.session.loggedIn = true;
        return res.redirect('/');
    } catch (error) {
        req.flash('error', `Form submission error: ${error}`);
        return res.redirect('/register-page')
    }
});

// handles logout by clearing cookies
app.post('/logout', (req,res) => {
    if (req.session.username) {
        // clear cookies
        req.session.user = null;
        req.session.loggedIn = false;
        req.flash('info', 'You are logged out');
        return res.redirect('/login-page');
    } else {
        req.flash('error', 'You are not logged in - please do so.');
        return res.redirect('/login-page');
    }
});

// profile page
app.get("/profile", requiresLogin,(req, res) => {
    return res.render("profile.ejs", {user: req.session.user, currentPage: "profile"});
});

// home page with search bar
app.get("/", requiresLogin, (req, res) => {
    return res.render("index.ejs", {results: [], currentPage: "home"});
});

// login page
app.get("/login-page", (req, res) => {
    return res.render("login.ejs");
});

// register page
app.get("/register-page", (req, res) => {
    return res.render("register.ejs");
});

// Finish documentation
/**
 * Flashes error message and redirects to login page if user not logged in
 * @param {*} req the request object
 * @param {*} res the response object
 * @param {*} next the next function to call if user is logged in
 * @returns 
 */
function requiresLogin(req, res, next) {
    if (!req.session.loggedIn) {
        req.flash('error', 'This page requires you to be logged in - please do so.');
        return res.redirect("/login-page");
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

