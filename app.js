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
    const requestParams = requestObject.params;
    const { tweetId } = requestParams;
    console.log(tweetId); //string
    const tweetQuery = `SELECT tweet.tweet_id AS tweet_id_user_following
    FROM user AS u1 INNER JOIN follower as f ON f.follower_user_id=u1.user_id INNER JOIN 
    user AS u2 ON u2.user_id=f.following_user_id INNER JOIN tweet ON tweet.user_id=u2.user_id 
    WHERE u1.username='${username}';`;
    const dbResponse1 = await dbConnectionObject.all(tweetQuery);
    /*
    if username=JoeBiden
    [
    {"tweet_id_user_following":1},
    {"tweet_id_user_following":2},
    {"tweet_id_user_following":7},
    {"tweet_id_user_following":8}
     ]
    */

    const tweet_id_user_followingArray = dbResponse1.map((eachObject) => {
      return eachObject.tweet_id_user_following;
    });
    console.log(tweet_id_user_followingArray); //[ 1, 2, 7, 8 ] if username=JoeBiden

    if (!tweet_id_user_followingArray.includes(parseInt(tweetId))) {
      responseObject.status(401);
      responseObject.send("Invalid Request");
    } else {
      const query = `SELECT t.tweet AS tweet, COUNT(DISTINCT l.like_id) AS likes,
    COUNT(DISTINCT r.reply_id) AS replies, t.date_time AS dateTime FROM tweet AS t 
    LEFT JOIN like AS l ON t.tweet_id = l.tweet_id LEFT JOIN reply AS r ON t.tweet_id = r.tweet_id 
    WHERE t.tweet_id = ${tweetId};`;
      const dbResponse = await dbConnectionObject.get(query);
      console.log(dbResponse);

      responseObject.send(dbResponse);
    }
  }
);

//section7 API 7:
app.get(
  "/tweets/:tweetId/likes/",
  authenticateJwtToken,
  async (requestObject, responseObject) => {
    const requestQuery = requestObject.query;
    const { username } = requestQuery;
    const requestParams = requestObject.params;
    const { tweetId } = requestParams;
    console.log(tweetId); //string
    const tweetQuery = `SELECT tweet.tweet_id AS tweet_id_user_following
    FROM user AS u1 INNER JOIN follower as f ON f.follower_user_id=u1.user_id INNER JOIN 
    user AS u2 ON u2.user_id=f.following_user_id INNER JOIN tweet ON tweet.user_id=u2.user_id 
    WHERE u1.username='${username}';`;
    const dbResponse1 = await dbConnectionObject.all(tweetQuery);
    /*
    if username=JoeBiden
    [
    {"tweet_id_user_following":1},
    {"tweet_id_user_following":2},
    {"tweet_id_user_following":7},
    {"tweet_id_user_following":8}
     ]
    */

    const tweet_id_user_followingArray = dbResponse1.map((eachObject) => {
      return eachObject.tweet_id_user_following;
    });
    console.log(tweet_id_user_followingArray); //[ 1, 2, 7, 8 ] if username=JoeBiden

    if (!tweet_id_user_followingArray.includes(parseInt(tweetId))) {
      responseObject.status(401);
      responseObject.send("Invalid Request");
    } else {
      const query = `SELECT DISTINCT(u1.username) FROM tweet AS t LEFT JOIN like AS l 
    ON t.tweet_id = l.tweet_id LEFT JOIN reply AS r ON t.tweet_id = r.tweet_id LEFT JOIN 
    user AS u1 ON u1.user_id=l.user_id  WHERE t.tweet_id = ${tweetId};`;
      const dbResponse = await dbConnectionObject.all(query);
      console.log(dbResponse);
      const ArrayNames = dbResponse.map((eachObject) => {
        return eachObject.username;
      });
      console.log(ArrayNames);
      const dbResponseResult = {
        likes: ArrayNames,
      };
      responseObject.send(dbResponseResult);
    }
  }
);

//section8 API 8:
app.get(
  "/tweets/:tweetId/replies/",
  authenticateJwtToken,
  async (requestObject, responseObject) => {
    const requestQuery = requestObject.query;
    const { username } = requestQuery;
    const requestParams = requestObject.params;
    const { tweetId } = requestParams;
    console.log(tweetId); //string
    const tweetQuery = `SELECT tweet.tweet_id AS tweet_id_user_following
    FROM user AS u1 INNER JOIN follower as f ON f.follower_user_id=u1.user_id INNER JOIN 
    user AS u2 ON u2.user_id=f.following_user_id INNER JOIN tweet ON tweet.user_id=u2.user_id 
    WHERE u1.username='${username}';`;
    const dbResponse1 = await dbConnectionObject.all(tweetQuery);
    /*
    if username=JoeBiden
    [
    {"tweet_id_user_following":1},
    {"tweet_id_user_following":2},
    {"tweet_id_user_following":7},
    {"tweet_id_user_following":8}
     ]
    */

    const tweet_id_user_followingArray = dbResponse1.map((eachObject) => {
      return eachObject.tweet_id_user_following;
    });
    console.log(tweet_id_user_followingArray); //[ 1, 2, 7, 8 ] if username=JoeBiden

    if (!tweet_id_user_followingArray.includes(parseInt(tweetId))) {
      responseObject.status(401);
      responseObject.send("Invalid Request");
    } else {
      const query = `SELECT DISTINCT u1.username AS name,r.reply AS reply FROM 
    tweet AS t LEFT JOIN like AS l ON t.tweet_id = l.tweet_id LEFT JOIN 
    reply AS r ON t.tweet_id = r.tweet_id LEFT JOIN user AS u1 ON u1.user_id=r.user_id 
    WHERE t.tweet_id = ${tweetId};`;
      const dbResponse = await dbConnectionObject.all(query);
      console.log(dbResponse);
      const dbResponseResult = {
        replies: dbResponse,
      };
      console.log(dbResponseResult);
      responseObject.send(dbResponseResult);
    }
  }
);

//section9 API 9:
app.get(
  "/user/tweets/",
  authenticateJwtToken,
  async (requestObject, responseObject) => {
    const requestQuery = requestObject.query;
    const { username } = requestQuery;
    const query = `SELECT t.tweet AS tweet,COUNT(DISTINCT(l.like_id)) AS likes,COUNT(DISTINCT(r.reply_id)) AS replies,t.date_time AS dateTime 
  FROM tweet AS t LEFT JOIN like AS l ON t.tweet_id=l.tweet_id LEFT JOIN reply AS r ON r.tweet_id=t.tweet_id JOIN user AS u ON t.user_id=u.user_id 
  WHERE u.username='${username}' GROUP BY t.tweet_id;`;
    const dbResponse = await dbConnectionObject.all(query);
    responseObject.send(dbResponse);
  }
);

//section10 API 10:
app.post("/user/tweets/", async (requestObject, responseObject) => {
  const requestQuery = requestObject.query;
  const { user_id } = requestQuery;
  const requestBody = requestObject.body;
  const { tweet } = requestBody;
  console.log(user_id);
  console.log(requestBody);
  const currentDate = new Date();

  console.log(currentDate);
  const formattedDate = format(currentDate, "yyyy-MM-dd HH:mm:ss");
  console.log(formattedDate);

  const createTweetQuery = `INSERT INTO tweet (tweet, user_id, date_time)
VALUES ('${tweet}',${user_id} , '${formattedDate}');
`;
  await dbConnectionObject.run(createTweetQuery);
  responseObject.send("Created a Tweet");
});

//section11 API 11:
app.delete(
  "/tweets/:tweetId/",
  authenticateJwtToken,
  async (requestObject, responseObject) => {
    const requestQuery = requestObject.query;
    const { username } = requestQuery;
    const requestParams = requestObject.params;
    const { tweetId } = requestParams;
    console.log(tweetId); //string
    const tweetQuery = `SELECT tweet.tweet_id AS tweet_id_user_following
    FROM user AS u1 INNER JOIN follower as f ON f.follower_user_id=u1.user_id INNER JOIN 
    user AS u2 ON u2.user_id=f.following_user_id INNER JOIN tweet ON tweet.user_id=u2.user_id 
    WHERE u1.username='${username}';`;
    const dbResponse1 = await dbConnectionObject.all(tweetQuery);
    /*
    if username=JoeBiden
    [
    {"tweet_id_user_following":1},
    {"tweet_id_user_following":2},
    {"tweet_id_user_following":7},
    {"tweet_id_user_following":8}
     ]
    */

    const tweet_id_user_followingArray = dbResponse1.map((eachObject) => {
      return eachObject.tweet_id_user_following;
    });
    console.log(tweet_id_user_followingArray); //[ 1, 2, 7, 8 ] if username=JoeBiden

    if (!tweet_id_user_followingArray.includes(parseInt(tweetId))) {
      responseObject.status(401);
      responseObject.send("Invalid Request");
    } else {
      const query = `DELETE FROM tweet WHERE tweet_id=${tweetId}`;
      await dbConnectionObject.run(query);
      responseObject.send("Tweet Removed");
    }
  }
);

module.exports = app;
