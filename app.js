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

//section1 API 1:
app.post("/register/", async (requestObject, responseObject) => {
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
      const hashedPassword = await bcrypt.hash(password, 10);
      const registerQuery = `INSERT INTO user(username, password, name, gender)
       VALUES ('${username}', '${hashedPassword}', '${name}', '${gender}');`;
      await dbConnectionObject.run(registerQuery);
      responseObject.status(200);
      responseObject.send("User created successfully");
    }
  }
});

//section2 API 2:

app.post("/login/", async (requestObject, responseObject) => {
  const requestBody = requestObject.body;
  const { username, password } = requestBody;
  const loginUsernameQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbResponse = await dbConnectionObject.get(loginUsernameQuery);
  if (dbResponse === undefined) {
    responseObject.status(400);
    responseObject.send("Invalid user");
  }
  if (dbResponse !== undefined) {
    const comparePassword = await bcrypt.compare(password, dbResponse.password);
    console.log(comparePassword);
    if (!comparePassword) {
      responseObject.status(400);
      responseObject.send("Invalid password");
    } else {
      const payload = { username: dbResponse.username };
      const jwtCreatedToken = await jwt.sign(payload, "MY_SECRET_TOKEN_STRING");
      responseObject.send({
        jwtToken: jwtCreatedToken,
      });
    }
  }
});

//middleware to authenticate the JWT token:
const authenticateJwtToken = (requestObject, responseObject, next) => {
  /*
    example:
    let options = {
        method: requestMethodEl.value,
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: "Bearer 956024779072d5b1668e3e20dce2bbd34377cccc9db7ff52e0b4a8a479c5cc7b"
        },
        body: requestBodyValue
    };
  */

  /*  
  console.log(requestObject.headers);
  {
  'user-agent': 'vscode-restclient',
  authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IkpvZUJpZGVuIiwiaWF0IjoxNjkxNzMzNTkxfQ.pr-0VY1GVd5EpndR7ua3Ta1H7nrDOzZi-Ok1OqFmCU4',
  'accept-encoding': 'gzip, deflate',
  host: 'localhost:3001',
  connection: 'close'
  }
  */
  const authorizationValue = requestObject.headers.authorization;
  let tokenValue;
  if (authorizationValue !== undefined) {
    const authorizationArray = authorizationValue.split(" ");
    /*
    console.log(authorizationArray);
    [
  'Bearer',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IkpvZUJpZGVuIiwiaWF0IjoxNjkxNzMzNTkxfQ.pr-0VY1GVd5EpndR7ua3Ta1H7nrDOzZi-Ok1OqFmCU4']
    */
    tokenValue = authorizationArray[1];
  }

  if (tokenValue === undefined) {
    responseObject.status(401);
    responseObject.send("Invalid JWT Token");
  } else {
    jwt.verify(tokenValue, "MY_SECRET_TOKEN_STRING", (error, payload) => {
      if (error) {
        responseObject.status(401);
        responseObject.send("Invalid JWT Token");
      } else {
        console.log(payload);
        /*
console.log(payload);
{ username: 'JoeBiden', iat: 1691818917 }
*/
        next();
      }
    });
  }
};

//section3 API 3:
app.get(
  "/user/tweets/feed/",
  authenticateJwtToken,
  async (requestObject, responseObject) => {
    console.log("authentication completed successfully");
    const requestQuery = requestObject.query;

    const { username } = requestQuery;

    const tweetQuery = `SELECT u2.username AS username,tweet,date_time AS dateTime
    FROM user AS u1 INNER JOIN follower as f ON f.follower_user_id=u1.user_id INNER JOIN 
    user AS u2 ON u2.user_id=f.following_user_id INNER JOIN tweet ON tweet.user_id=u2.user_id 
    WHERE u1.username='${username}' ORDER BY dateTime DESC LIMIT ${4} OFFSET ${0};`;
    const dbResponse = await dbConnectionObject.all(tweetQuery);
    const dbResponseResult = dbResponse.map((eachObject) => ({
      username: eachObject.username,
      tweet: eachObject.tweet,
      dateTime: eachObject.dateTime,
    }));

    responseObject.send(dbResponseResult);
  }
);

//section4 API 4:
app.get(
  "/user/following/",
  authenticateJwtToken,
  async (requestObject, responseObject) => {
    const requestQuery = requestObject.query;
    const { username } = requestQuery;
    const tweetQuery = `SELECT distinct(u2.name) AS name
    FROM user AS u1 INNER JOIN follower as f ON f.follower_user_id=u1.user_id INNER JOIN 
    user AS u2 ON u2.user_id=f.following_user_id INNER JOIN tweet ON tweet.user_id=u2.user_id 
    WHERE u1.username='${username}';`;
    const dbResponse = await dbConnectionObject.all(tweetQuery);
    const dbResponseResult = dbResponse.map((eachObject) => ({
      name: eachObject.name,
    }));
    responseObject.send(dbResponseResult);
  }
);

//section5 API 5:
app.get(
  "/user/followers/",
  authenticateJwtToken,
  async (requestObject, responseObject) => {
    const requestQuery = requestObject.query;
    const { username } = requestQuery;
    const tweetQuery = `SELECT u2.name AS name FROM user AS u1  INNER JOIN follower
    AS f1 ON u1.user_id=f1.following_user_id INNER JOIN user AS u2 
    ON u2.user_id=f1.follower_user_id WHERE u1.username='${username}';`;
    const dbResponse = await dbConnectionObject.all(tweetQuery);
    const dbResponseResult = dbResponse.map((eachObject) => ({
      name: eachObject.name,
    }));
    responseObject.send(dbResponseResult);
  }
);

//section6 API 6:
app.get(
  "/tweets/:tweetId/",
  authenticateJwtToken,
  async (requestObject, responseObject) => {
    const requestQuery = requestObject.query;
    const { username } = requestQuery;
  }
);

module.exports = app;
