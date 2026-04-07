// Annie Chen and Emily Zhu
"use strict";

const path = require('path');

require("dotenv").config({ path: path.join(process.env.HOME, '.cs304env')});
const { Connection } = require('./connection');
const cs304 = require('./cs304');
const bcrypt = require('bcrypt');

const mongoUri = cs304.getMongoUri();

const myDBName = "annemily";

const courseData = require('./spring26courses.json');
const courseDataLen = courseData.length;
console.log(courseData);

const ROUNDS = 15;

// insert course
async function insertCourse(db, course) {
  // process data
  const section = course["Section"];
  const dept = section.split(" ")[0];
  const sectionNum = section.split(" ")[1];
  const num = sectionNum.split("-")[0];
  const longTitle = course["Section Long Title"];
  const allInstructors = course["All Instructors"];

  const result = await db.collection('courses').insertOne({
    course_num: num,
    department: dept,
    title: longTitle,
    instructors: allInstructors,
  });
  return result;
}


async function addUsers(db) {
  let passwd1 = '1234';
  let passwd2 = 'pretenditshashed';
  let passwd3 = 'icecream789';
  let hash1 = await bcrypt.hash(passwd1, ROUNDS);
  let hash2 = await bcrypt.hash(passwd2, ROUNDS);
  let hash3 = await bcrypt.hash(passwd3, ROUNDS);

  await db.collection('users').insertOne({
    user_id: "ac134",
    email: "ac134@wellesley.edu",
    username: "annie",
    hash: hash1,
    role: "admin",
    class_year: "2026",
    reviews: null
  });

  await db.collection('users').insertOne({
    user_id: "ez107",
    email: "ez107@wellesley.edu",
    username: "foodlover",
    hash: hash2,
    role: "admin",
    class_year: "2028",
    reviews: null
  });

  await db.collection('users').insertOne({
    user_id: "gh104",
    email: "gh104@wellesley.edu",
    username: "genesis",
    hash: hash3,
    role: "student",
    class_year: "2026",
    reviews: null
  });

  return;
}


async function addReviews(db) {
  await db.collection('reviews').insertOne({
    review_id: "0001",
    course: "AMST264",
    user: "ac134",
    date: "04/03/2026",
    hours_per_week: 8,
    difficulty: 3,
    take_again: 0,
    tags: ["Easy A", "No tests"],
    comments: "Very chill class, good for distributions."
  });

  await db.collection('reviews').insertOne({
    review_id: "0002",
    course: "CS304",
    user: "ez107",
    date: "04/03/2026",
    hours_per_week: 9,
    difficulty: 4,
    take_again: 1,
    tags: ["300-level", "Flipped Classroom"],
    comments: "Project based, good for CS majors."
  });

  await db.collection('reviews').insertOne({
    review_id: "0003",
    course: "CS231",
    user: "ez107",
    date: "04/01/2026",
    hours_per_week: 12,
    difficulty: 4.5,
    take_again: 1,
    tags: ["Reading heavy"],
    comments: "Help."
  });

  await db.collection('reviews').insertOne({
    review_id: "0004",
    course: "LING114",
    user: "ez107",
    date: "04/05/2026",
    hours_per_week: 3,
    difficulty: 1.5,
    take_again: 1,
    tags: ["Easy A"],
    comments: "Nice class, love Professor Fisher."
  });

  return;
}


async function main() {
  const my_db = await Connection.open(mongoUri, myDBName);

  console.log('reset database...\n');

  await my_db.collection('courses').deleteMany({ }); 
  await my_db.collection('users').deleteMany({ }); 
  await my_db.collection('reviews').deleteMany({ }); 
  
  console.log('starting course insertion...\n');

  for (let i = 0; i < courseDataLen; i++) {
    console.log("iteration number: " + i);
    const course = courseData[i];
    await insertCourse(my_db, course);
  }

  console.log('starting user and review insertion...\n');

  await addUsers(my_db);
  await addReviews(my_db);

  console.log('updating courses...\n');

  await my_db.collection('courses').updateOne(
    { course_num: "304" , department: "CS" },
    { $set: { distributions: ["MM"] , avgHours: 9, avgDifficulty: 3.33, retake: 0.8, tags: ["Flipped Classroom", "300-level"]}}
  );

  await my_db.collection('courses').updateOne(
    { course_num: "231" , department: "CS" },
    { $set: { distributions: ["MM"] , avgHours: 13, avgDifficulty: 4.79, retake: 0.34, tags: ["Reading heavy"]}}
  );

  await Connection.close();
}

main().catch(console.error);
