# Course-Insights

# Course Insights: your guide to course registration.

# Intro
Course registration is one of the most important series of decisions in a college student’s school career. Choosing which courses to take can feel daunting, as they can define how the semester will go. Our project is a course insight web application designed to help students make more informed decisions about course selection. At its core, Course Insights is similar to Rate My Professor, but it goes much further. Course Insights is focused on the course experience itself, rather than solely on Professor ratings. It highlights course workload, structure, syllabus transparency, distribution requirements, and many more qualities that students care about in a course. From personal experience being students at Wellesley College, Annie and Emily chose to have Course Insights highlight the information they most wanted to see when deciding which courses to take. 

# Features

# Verified logins and sessions
This application should cater to users with Wellesley email addresses, specifically students. Faculty and other non-students with Wellesley email addresses should not be able to use the application, so that students can be honest and have privacy within their course reviews. In order to authenticate users, our application will have verified logins using passwords that are stored in the database using a hashing algorithm. Additionally, for security, there will be sessions, ending after users log out. For moderation purposes, administrators such as Annie and Emily will have different permissions than normal users in that we can remove other users' course reviews, syllabi uploads, etc, while normal users will only be able to edit their own course reviews.

# Upload course review
Students will be able to upload a course review for any course, existent or not in the database. If the course already exists, the review will be associated with that existing course using database keys. If the course does not exist, our application will create a new course record and then attach the review. To streamline initial development, Annie and Emily will pre-populate the database with all currently offered courses, either through web scraping or manual insertion. This way, the system does not have to rely on admin to continuously update the courses in the system. Then, when new courses are created, other users will be able to review the new courses as well. Additionally, users will be able to update and delete their old reviews. Since courses and professors grow and change over time, allowing users to update reviews ensures that the web page reflects the most current perspectives.

# Syllabus upload
In the past, students have often asked other students for course syllabi to assess a course’s workload and before determining whether to take it. Therefore, one of the distinguishing features of Course Insights is that unlike many other course review applications, users will be able to upload syllabi as part of the course reviews. Behind the scenes, syllabus files will be uploaded using Multer. The application will check the content and size of the file to make sure it doesn't contain overwhelming or irrelevant data. It will also make sure the file doesn’t contain anything executable. The most recent syllabus uploaded will be displayed for each course and professor as course syllabi are updated quite frequently.

# Displays a summary review of each course
When viewing a course on Course Insights, students will see a summary dashboard for that specific course. The summary dashboard consolidates the data from each and every review from students, and aggregates it into a summary statistic. We will have summary metrics such as average hours per week, average grade in the class, average difficulty, and most popular tags. This allows students to easily parse through potentially way too many reviews in one easy look, reducing their cognitive load and improving their decision making.

# Search
The homepage of the website should be similar to that of Rate My Professor’s—a search bar with filters. To make the course reviews more easily viewable, users should be able to filter by major, department, distribution requirement, and tags such as “Easy A,” “Heavy Workload,” etc. To display the filter, we would use an HTML form with a dropdown question. Then, we would take the user input to group, filter, and display the documents using the MongoDB aggregation pipeline.

# Data to be collected
In order to make such a web application, we’ll create one database with three main collections: Users, Courses, and Reviews. Here are the main components per collection.

Users: user_id, email, password, role (student or alum), and class year. 
Courses: course_id, department, title, distributions, description, and any other relevant fields. 
Reviews: review_id, course, user, date, tags, metrics( difficulty, weekly hours, etc.) upvotes/downvotes, date.

Between each collection, we will have the following database relations. For each review, the course entry will correspond to the course_id for a course, and the user entry will correspond to the user_id of a user. Upvotes/downvotes will also be connected to the user_id of the user who reacted to the review.

We’ll need to run queries to display the courses when users search for courses. This will be based off of any entry in the course: course_id, department, title, distributions, description, and any other relevant fields. For a single course, we will also need to query the reviews associated with that course. Within a course, we will also allow users to filter for more specific reviews, including by professor. We will need to run further queries to display this information. The database will be updated whenever a user creates an account, adds a course, adds a review, modifies their review, or reacts to another review.

The only web form we’ll need to create is for users entering a course review. It will directly be funneled into the review database relation as a new entry. 

# Conclusion
Course Insights will be a valuable resource for Wellesley students during course planning registration, containing five different features that will help with the security and usability of the application. Students will be able to gain knowledge about their potential courses and read reviews from peers who have taken the class. 
