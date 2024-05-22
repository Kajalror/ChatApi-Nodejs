
// https://github.com/Kajalror/ChatApi-Nodejs.git
const express = require("express");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const io = require("socket.io")(8080, {
  cors: {
    origin: "http://localhost:3000",
  },
});

//import files
const Users = require("./models/Users.js");
const Conversations = require("./models/Conversation.js");
const Messages = require("./models/Messages.js");
// const Conversation = require("./models/Conversation.js");

const app = express();
const cors = require("cors");
//app Use

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(cors());
const { default: mongoose } = require("mongoose");

app.use((err, req, res, next) => {
  console.error(err.stack); // Log errors
  res.status(500).send("Internal Server Error 0");
});

const port = process.env.PORT || 7000;

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("database successfully connected");
  })
  .catch((error) => {
    console.log(error.message);
  });

//socket.io
let users = [];
io.on("connection", (socket) => {
  console.log("User connected", socket.id);

  socket.on("addUser", (userId) => {
    const isUserExist = users.find((user) => user.id === userId);
    if (isUserExist) {
      const user = { id: userId, socketId: socket.id };
      user.push(user);
      io.emit("getUsers ", userId);
    }
  });
  socket.on(
    "sendMessage",
    async ({ userId, retailerId, message, _conversationId }) => {
      const retailer = users.find((user) => user.id === retailerId);
      // console.log("receiver socket", retailer); // receiver
      const sender = users.find((user) => user.id === userId);
      // console.log("sender socket", sender); // sender
      const user = await Users.findById(userId);
      // console.log("user find by userId ", user);

      if (retailer && sender) {
        io.to(retailer.socketId)
          .to(sender.socketId)
          .emit("getMessage", {
            userId,
            message,
            _conversationId,
            retailerId,
            user: { id: user._id, fullName: user.fullName, email: user.email },
          });
      }
    }
  );

  socket.on("disconnect", () => {
    users = users.filter((user) => user.socketId === socket.id);
    io.emit("getUsers", users);
    console.log("User disconnected", socket.id);
  });
});

app.get("/", (req, res) => {
  res.send("welcome to my backend");
});

app.post("/api/register", async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) {
      res.status(400).send("please fill all required fields");
    } else {
      const isAlreadyExist = await Users.findOne({ email });
      if (isAlreadyExist) {
        res.status(400).send("user already exists");
      } else {
        const newUser = new Users({ fullName, email });
        bcryptjs.hash(password, 10, (err, hashedPassword) => {
          if (err) {
            console.error("Error hashing password:", err);
            return res.status(500).send(" Server Error_");
          }
          newUser.set("password", hashedPassword);
          newUser.save();
          next();
        });
        return res.status(202).send("User registered successfully");
      }
    }
  } catch (error) {
    console.log(error, "Error");
    res.status(500).send("Internal Server Error");
  }
});

//login after the register

app.post("/api/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).send("Please fill all required fields");
    } else {
      const user = await Users.findOne({ email });
      if (!user) {
        res.status(400).send("Users email or password is incorrect");
      } else {
        const validateUser = await bcryptjs.compare(password, user.password);
        //password encryption
        if (!validateUser) {
          res.status(400).send("Users email or password is incorrect");
        } else {
          const payload = {
            userId: user.id,
            email: user.email,
          };
          const JWT_SECRET_KEY = process?.env?.JWT_SECRET_KEY;
          console.log("--secret Key : ", JWT_SECRET_KEY);
          jwt.sign(
            payload,
            JWT_SECRET_KEY,
            { expiresIn: 84600 },
            async (err, token) => {
              if (err) {
                console.error("Error generating token:", err);
                return res.status(500).send(" Server Error_2");
              } else {
                console.log("Generated token: ", token);
                await Users.updateOne({ _id: user._id }, { $set: { token } });
                user.save();
                res.status(200).json({
                  user: {
                    id: user._id,
                    email: user.email,
                    fullName: user.fullName,
                    tokens: token,
                  },
                });
              }
            }
          );
        }
      }
    }
  } catch (error) {
    console.log(error, "Error");
    res.status(500).send("Internal Server Error2");
  }
});

// how to fetch and create a conversation id

app.post("/api/conversation", async (req, res) => {
  try {
    const { retailerId, userId, _conversationId } = req.body;
    if (!_conversationId) {
      console.log("Invalid conversation ID format");
      return res.status(400).send("Invalid conversation ID format");
    }
    const existingConversation = await Conversations.findOne({
      _conversationId: _conversationId,
    });
    if (existingConversation) {
      return res.status(200).send("Conversation already exists");
    }
    const newConversation = new Conversations({
      retailerId,
      userId,
      _conversationId: _conversationId,
    });
    await newConversation.save();
    console.log("---conversation api's", newConversation);

    res.status(200).send("Conversation created successfully");
  } catch (error) {
    console.log(error, "Error");
    res.status(500).send("Internal server error");
  }
});

app.get("/api/conversation/:conversationId", async (req, res) => {
  try {
    const conversationId = req.params.conversationId;

    const [retailerId, userId] = conversationId.split("-");
    console.log("__user id from conversation api ",userId)
    const conversation = await Conversations.findOne({
      retailerId: retailerId,
    });

    console.log("Conversation Id find :", conversation); //true

    if (!conversation) {
      console.log("Conversation not found for Id:", conversationId);
      return res.status(404).json({ error: "Conversation not found" });
    }
    const receiver = await Users?.findById({ _id: retailerId });
    console.log(receiver, "receiver found");
    if (!receiver) {
      console.log("Receiver not found for retailerId:", retailerId);
      return res.status(404).json({ error: "Receiver not found" });
    }
    res.status(200).json({
      conversation,
      receiver: {
        id: receiver?._id,
        fullName: receiver.fullName,
        email: receiver.email,
      },
    });
  } catch (error) {
    console.error("Error fetching conversation data:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//<--- success --->

app.post("/api/message", async (req, res) => {
  try {
    const { _conversationId, userId, message, retailerId = "" } = req.body;
    console.log("post message ", _conversationId, userId, message, retailerId);
    if (!userId || !message)
      return res.status(400).send("please fill all required fields1");
    if (_conversationId === "new" && retailerId) {
      const newConversation = new Conversations({
        members: [userId, retailerId],
      });
      await newConversation.save();
      const newMessage = new Messages({
        _conversationId: newConversation?._id,
        userId,
        message,
      });
      await newMessage.save();
      console.log("Message saved:", newMessage);
      return res.status(200).send(" Message sent successfully");
    } else if (!_conversationId && !retailerId) {
      return res.status(400).send("please fill all required fields2");
    }
    const newMessage = new Messages({
      _conversationId,
      userId,
      message,
      retailerId,
    });
    await newMessage.save();
    res.status(200).json("Messages sent successfully");
  } catch (error) {
    console.log(error, "Error");
  }
});

app.get("/api/message/:_conversationId", async (req, res) => {
  try {
    const conversationId = req.params._conversationId;
    console.log(" conversation id for msg : ", conversationId); // true
    if (!conversationId) {
      console.error("Conversation ID is missing");
      return res.status(400).json({ error: "Conversation ID is missing" });
    }
    const checkMessages = async (conversationId) => {
      console.log(`Fetching messages for conversation ID: ${conversationId}`);
      const messages = await Messages.find({ _conversationId: conversationId });

      console.log("check messages type--messages", messages);
      //this is correct shows only [ array of messages ]

      if (!messages.length) {
        console.log("No messages found for this conversation ID");
        return res
          .status(404)
          .json({ error: "No messages found for this conversation ID" });
      }

      const messageUserData = await Promise?.all(
        messages.map(async (message) => {
          const user = await Users.findById(message?.userId);
          return {
            id: user?._id,
            email: user?.email,
            fullName: user?.fullName,
            message: message?.message,
          };
        })
      );
      res.status(200).json(messageUserData);
    };
    //its shows empty [] 'true condition

    if (conversationId === "new") {
      const { userId, retailerId } = req.query;
      if (!userId || !retailerId) {
        return res
          .status(400)
          .json({
            error:
              "userId and retailerId query parameters are required for new conversations",
          });
      }
      const checkConversation = await Conversations.findOne({
        userId: userId,
        retailerId: retailerId,
      });
      if (checkConversation) {
        console.log("Found existing conversation:", checkConversation);
        await checkMessages(checkConversation._conversationId);
      } else {
        console.log("No existing conversation found");
        return res.status(200).json([]);
      }
    } else {
      await checkMessages(conversationId);
    }
  } catch (error) {
    console.log(error, "Error");
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await Users?.find();
    const usersData = Promise.all(
      users?.map(async (user) => {
        return {
          email: user?.email,
          fullName: user?.fullName,
          receiverId: user?.id,
        };
      })
    );
    res.status(200).json(await usersData);
    console.log("user form users ", usersData);
  } catch (error) {
    console.log(error, "Error");
  }
});

app.listen(port, () => {
  console.log("listening on port" + " " + port);
});
