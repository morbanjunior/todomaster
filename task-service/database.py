import os
from pymongo import MongoClient

MONGO_URL = os.environ["MONGO_URL"]

client = MongoClient(MONGO_URL)
db = client["task_db"]
tasks_collection = db["tasks"]
