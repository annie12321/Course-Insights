// Annie Chen and Emily Zhu
"use strict";

// standard modules, loaded from node_modules
const path = require('path');
require("dotenv").config({ path: path.join(process.env.HOME, '.cs304env')});
const express = require('express');
const morgan = require('morgan');
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

app.use(serveStatic('public'));
app.set('view engine', 'ejs');

const mongoUri = cs304.getMongoUri();
const myDBName = "annemily";

// login page
app.get("/login", (req, res) => {
    return res.render("login.ejs");
});

// register account page
app.get("/register", (req, res) => {
    return res.render("register.ejs");
});

//example user (delete later)
const user = {
    username: "annemily",
    role: "student",
    email: "123@wellesley.edu",
    classYear: "2024",
    reviews: ["hello world", "this is a review"],
};


// profile page
app.get("/profile", (req, res) => {
    return res.render("profile.ejs", {user: user, currentPage: "profile"});
});

// home page with search bar
app.get("/", (req, res) => {
    return res.render("index.ejs", {results: [], currentPage: "home"});
});

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

