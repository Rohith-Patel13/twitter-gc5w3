const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const { format, addDays, differenceInDays, parse } = require("date-fns");
const app = express();
app.use(express.json());
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const dbPath = path.join(__dirname, "twitterClone.db");
let dbConnectionObject = null;
const initializeDBAndServer = async () => {
  try {
    dbConnectionObject = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3001, () => {
      console.log("Server Running at http://localhost:3001/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

//API 1 middleware validation
const registrationValidation = async (requestObject, responseObject, next) => {
  let isValid = true;
  const requestBody = requestObject.body;
  const { username, password, name, gender } = requestBody;
  const registerUsernameQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbResponse = await dbConnectionObject.get(registerUsernameQuery);
  if (dbResponse !== undefined) {
    responseObject.status(400);
    responseObject.send("User already exists");
  }
  if (dbResponse === undefined) {
    if (password.length < 6) {
      responseObject.status(400);
      responseObject.send("Password is too short");
    } else {
      next();
    }
  }
};

//API 1
app.post(
  "/register/",
  registrationValidation,
  async (requestObject, responseObject) => {
    const requestBody = requestObject.body;
    const { username, password, name, gender } = requestBody;
    const hashedPassword = await bcrypt.hash(password, 10);
    const registerQuery = `INSERT INTO user(username, password, name, gender)
       VALUES ('${username}', '${hashedPassword}', '${name}', '${gender}');`;
    await dbConnectionObject.run(registerQuery);
    responseObject.status(400);
    responseObject.send("User created successfully");
  }
);
