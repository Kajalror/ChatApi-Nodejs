
// https://member.osat.in

const express = require("express");
const multer = require("multer");
const path = require("path");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

require("dotenv").config();

const io = require("socket.io")(8011, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});







//import files
const Users = require("./models/Users.js");
const Conversations = require("./models/Conversation.js");
const Messages = require("./models/Messages.js");
const File = require('./models/File');

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("message", (newMessage) => {
    io.emit("message", newMessage);
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });

});


io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("message", async (newMessage) => {
    const { _conversationId, userId, message, retailerId } = newMessage;
    console.log("User connected", newMessage);

    const newMessageEntry = new Messages({
      _conversationId,
      userId,
      message,
      retailerId,
    });

    await newMessageEntry.save();
    io.emit("messages", newMessage);
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});




const app = express();
const cors = require("cors");
//app Use

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

//multer
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


app.use(cors());




app.use((err, req, res, next) => {
  console.error(err.stack); 
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

//multer

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

      
  


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



app.post("/api/conversation", async (req, res) => {
  try {
    const { retailerId, userId } = req.body;
    let conversation = await Conversations.findOne({ retailerId, userId }) ||
                       await Conversations.findOne({ retailerId: userId, userId: retailerId });

    if (conversation) {
      return res.status(200).json({ message: "Conversation ID exists", conversationId: conversation._conversationId });
    }
    const _conversationId = `${retailerId}-${userId}`;
    conversation = new Conversations({ retailerId, userId, _conversationId });
    await conversation.save();
    res.status(200).json({ message: "Conversation ID Created", conversationId: conversation._conversationId });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal server error");
  }
});




app.get("/api/conversation/:conversationId", async (req, res) => {
  try {
    const conversationId = req.params.conversationId;

    const [retailerId, userId] = conversationId.split("-");
    // console.log("__user-id from conversation api",userId)
    const conversation = await Conversations.findOne({
      retailerId: retailerId,
    });
    // console.log("Conversation Id find :", conversation);    //true

    if (!conversation) {
      // console.log("Conversation not found for Id:", conversationId);
      return res.status(404).json({ error: "Conversation not found" });
    }
    const receiver = await Users?.findById({ _id: retailerId });
    // console.log(receiver, "receiver found");
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
    const { _conversationId, userId, message, retailerId = " " } = req.body;
    console.log("Message post message----", req.body);

    if (!userId || !message) {
      return res.status(400).send("Please fill all required fields.");
    }

    if (_conversationId === "new" && retailerId) {
      const newConversationId = `${userId}-${retailerId}`;
      console.log("set up id --- ", newConversationId);
      const newConversation = new Conversations({
        _conversationId: newConversationId,
        userId,
        retailerId,
      });
      await newConversation.save();

      const newMessage = new Messages({
        _conversationId: newConversationId,
        userId,
        message,
        retailerId,
      });
      console.log("Message saved:",await newMessage);
      await newMessage.save();
      return res.status(201).json({ _conversationId: newConversationId });
    } else if (!_conversationId && !retailerId) {
      return res.status(400).send("Please fill all required fields.");
    }

    // const newMessage = new Messages({
    //   _conversationId,
    //   userId,
    //   message,
    //   retailerId,
    // });
    // // console.log("new message() ", newMessage);
    // await newMessage.save();
    // res.status(200).json("Message sent successfully");
  } catch (error) {
    console.log(error, "Error");
    res.status(500).json({ error: "Internal server error" });
  }
});


app.get("/api/message/:_conversationId", async (req, res) => {
  try {
    const conversationId = req.params._conversationId;

    if (!conversationId) {
      return res.status(400).json({ error: "Conversation ID is missing" });
    }

    const checkMessages = async (conversationId) => {
      const messages = await Messages.find({ _conversationId: conversationId });
      // console.log("check messages conversationId ", messages);
      if (!messages.length) {
        return res.status(404).json({ error: "No messages found for this conversation ID" });
      }

      const messageUserData = await Promise.all(
        messages.map(async (message) => {
          const user = await Users.findById(message?.userId);
          // console.log("user message user--data ", user);
          return {
            userId: message.userId,
            id: user?._id,
            email: user?.email,
            fullName: user?.fullName,
            message: message.message,
          };
        })
      );
      res.status(200).json(messageUserData);
    };

    if (conversationId === "new") {
      const { userId, retailerId } = req.query;
      if (!userId || !retailerId) {
        return res.status(400).json({
          error: "userId and retailerId query parameters are required for new conversations",
        });
      }
      const checkConversation = await Conversations.findOne({ userId, retailerId });

    console.log("check conversation !!!--- ", checkConversation);

      if (checkConversation) {
        return res.status(200).json({ _conversationId: checkConversation._conversationId });
      } else {
        const newConversationId = `${userId}-${retailerId}`;
        console.log("check new conversation id  --- ", checkConversation);
        const newConversation = new Conversations({
          _conversationId: newConversationId,
          userId,
          retailerId,
        });
        console.log("new conversation ,,,,api", newConversation);
        await newConversation.save();
        return res.status(201).json({ _conversationId: newConversationId });
      }
    } else {
      const existingConversation = await Conversations.findOne({ _conversationId: conversationId });
      // console.log("existing conversation", existingConversation);
      if (existingConversation) {
        await checkMessages(conversationId);
      } else {
        return res.status(404).json({ error: "Conversation not found" });
      }
    }
  } catch (error) {
    console.log(error, "Error");
    res.status(500).json({ error: "Internal server error" });
  }
});





/* 
    app.post("/api/upload", upload.single("file"), (req, res) => {
      if (req.file) {
        console.log("Upload--", req.file);
        res.status(200).json({ url: `/uploads/${req.file.filename}` });
      } else {
        res.status(400).json({ error: "File upload failed" });
      }
    });
*/



app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (req.file) {
    try {
      // Save file metadata to MongoDB
      const fileRecord = new File({
        filename: req?.file?.filename,
        path: `/uploads/${req?.file?.filename}`
      });
      await fileRecord.save();
      console.log('Upload--', req?.file);
      res.status(200).json({ url: fileRecord?.path });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ error: 'Failed to save file metadata to database' });
    }
  } else {
    res.status(400).json({ error: 'File upload failed' });
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
    // console.log("user form users ", usersData);
  } catch (error) {
    console.log(error, "Error");
  }
});

app.listen(port, () => {
  console.log("listening on port" + " " + port);
});
