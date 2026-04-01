// Annie Chen and Emily Zhu
"use strict";

const path = require('path');
require("dotenv").config({ path: path.join(process.env.HOME, '.cs304env')});
const { Connection } = require('./connection');
const cs304 = require('./cs304');

const mongoUri = cs304.getMongoUri();

const myDBName = "annemily";

import courseData from './spring26courses.json' with { type: 'json' };

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
    instructors: allInstructors
  });
  return result;
}


async function main() {
  console.log('starting insertion...\n');

  const my_db = await Connection.open(mongoUri, myDBName);

  courseDataLen = length(courseData);
  for (let i = 0; i < courseDataLen; i++) {
    console.log("iteration number: " + i);
    course = courseData[0];
    await insertCourse(my_db, course);
  }

  await Connection.close();
}

main().catch(console.error);
