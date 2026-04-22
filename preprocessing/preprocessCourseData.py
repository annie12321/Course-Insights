import pandas as pd
# from pymongo import MongoClient

# read in spring26courses using pandas
spring26df = pd.read_csv("spring26courses.csv")

# process spring26df to populate database
spring26df = spring26df[['Section', 'Section Long Title', 'All Instructors',
                         'Course Tags', 'Academic Units']]
       
# print(spring26df)
print(spring26df.columns)

# export list of dictionaries that makes it easy to add into mongoDB database
spring26df.to_json('spring26courses.json', orient='records')