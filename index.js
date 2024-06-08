const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors({
    origin: [
        "http://localhost:5173",
        // todo: production url
    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xyqwep0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


// my middleware
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    console.log('Verifying token', token);
    if (!token) {
        return res.status(401).send({ message: 'Not authorized' });
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            console.log(err);
            return res.status(401).send({ message: 'Not authorized' });
        }
        req.user = decoded;
        console.log('decoded', decoded);
        next();
    })

};

async function run() {
    try {
        // Connect the client to the server (optional starting in v4.7)
        // await client.connect();

        const database = client.db("eatsExchangeDB");
        const foodCollection = database.collection("foods");
        const requestCollection = database.collection("requests");

        //jwt auth
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            console.log(user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10h' });
            res
                .cookie("token", token, {
                    httpOnly: true,
                    secure: true,
                    sameSite: "none",
                })
                .send({ success: true });
        });

        app.get("/logout", async (req, res) => {
            res.clearCookie("token")
                .send({ success: true });
        });

        // foods collection
        app.get("/foods", async (req, res) => {
            const sortByDate = req.query?.sortByDate;
            const sortByQuantity = req.query?.sortByQuantity;
            const limit = parseInt(req.query.limit);
            const search = req.query?.search;
            const email = req.query?.email;

            let filter = {};
            if (search) filter.FoodName = { $regex: search, $options: 'i' };
            if (email) filter = { "Donator.Email": email };

            const options = {};
            if (sortByDate === 'acc') options.sort = { ExpiredDateTime: 1 };
            if (sortByDate === 'dec') options.sort = { ExpiredDateTime: -1 };
            if (sortByQuantity) options.sort = { FoodQuantity: -1 };

            const result = await foodCollection.find(filter, options).limit(limit).toArray();
            res.send(result);
        });

        app.get("/foods/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await foodCollection.findOne(query);
            res.send(result);
        });

        app.post("/foods", verifyToken, async (req, res) => {
            const food = req.body;
            console.log(food);
            const result = await foodCollection.insertOne(food);
            res.send(result);
        });

        app.put("/foods/:id", async (req, res) => {
            const id = req.params.id;
            const food = req.body;
            console.log(id, food);
            const filter = { _id: new ObjectId(id) };

            const options = { upsert: true };
            const UpdatedFood = {
                $set: {
                    FoodImage: food.FoodImage,
                    FoodName: food.FoodName,
                    Donator: {
                        Image: food.Donator.Image,
                        Name: food.Donator.Name,
                        Email: food.Donator.Email
                    },
                    FoodQuantity: food.FoodQuantity,
                    PickupLocation: food.PickupLocation,
                    ExpiredDateTime: food.ExpiredDateTime,
                    AdditionalNotes: food.AdditionalNotes
                }
            };
            const result = await foodCollection.updateOne(filter, UpdatedFood, options);
            res.send(result);
        });

        app.delete("/foods/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const result = await foodCollection.deleteOne(query);
            res.send(result);
        });

        // request collection
        app.post("/requests", verifyToken, async (req, res) => {
            const request = req.body;
            console.log(request);
            const result = await requestCollection.insertOne(request);
            res.send(result);
        });

        app.get("/requests", verifyToken, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                return res.status(403).send({ message: 'Not found' });
            }
            if (req.user.email !== email) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }
            const filter = { "Requester.Email": email }
            const result = await requestCollection.find(filter).toArray();
            res.send(result);
        });

        app.get("/requests/:FoodId", verifyToken, async (req, res) => {
            const FoodId = req.params.FoodId;
            const query = { FoodId: FoodId };
            const result = await requestCollection.find(query).toArray();
            res.send(result);
        });

        app.patch("/requests/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const request = req.body;
            console.log(id, request);
            const filter = { _id: new ObjectId(id) };
            const UpdatedRequest = {
                $set: {
                    Status: request.Status,
                }
            };
            const result = await requestCollection.updateOne(filter, UpdatedRequest);
            res.send(result);
        });

        app.delete("/requests/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await requestCollection.deleteOne(query);
            res.send(result);
        });


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Eats Exchange Server is running');
});

app.listen(port, () => {
    console.log(`Eats Exchange Server is running on port ${port}`);
});