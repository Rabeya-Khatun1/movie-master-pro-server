const express = require('express')
const cors = require('cors');
const admin = require("firebase-admin");
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = 3000;

// middleware 
app.use(cors())
app.use(express.json())



// index.js
const decoded = Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});



const verifyFirebaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    res.status(401).send({ message: 'unauthorized access' })
  }
  const token = authorization.split(' ')[1];
  try {

    const decoded = await admin.auth().verifyIdToken(token)
    // console.log('inside decoded', decoded.email)
    req.token_email = decoded.email;
    next();
  }
  catch (error) {
    res.status(401).send({ message: 'unauthorized access' })

  }
}

// const verifyJWTToken = async (req, res, next)=>{

//   const authorization = req.headers.authorization;
//   if(!authorization){
//     res.status(401).send({message: 'unauthorized access'})
//   }
//   const token = authorization.split(' ')[1]
  
//   if(!token){
// res.status(401).send({message: 'unauthorized access'})
  
// }
//   // verify 
// try{
// jwt.verify(token,process.env.JWT_SECRET, (err, decoded)=>{
//   if(err){
//     return res.status(401).send({message: 'unauthorized access'})
//   }
//   req.token_email= decoded.email;
//   next()
// })

// }
// catch{
// res.status(401).send({message: 'unauthorized access'})
// }


// }

app.get('/', (req, res) => {
  res.send('hello world')
})

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.sc7dsau.mongodb.net/?appName=Cluster0`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
  try {

  // await client.connect();


    const db = client.db('movies_db')

    const moviesCollection = db.collection('movies')
    const usersCollection = db.collection('users');
const watchlistCollection = db.collection('watchlist')



// watchlist post apis 
app.post('/watchlist', verifyFirebaseToken, async (req, res)=>{
  const {movieId} = req.body

const email = req.token_email;
const query = {email: email,movieId}
const existedWatchlist = await watchlistCollection.findOne(query)
if(existedWatchlist){
  return res.send({message: 'Movie already exist'})
}
else{
const result = await watchlistCollection.insertOne({
  email,
  movieId,
  addedAt: new Date()
})
res.send(result)
}

})

app.get('/watchlist', verifyFirebaseToken, async(req, res)=>{
  const email = req.token_email;
  const cursor =watchlistCollection.find({email})
  const result = await cursor.toArray();
  res.send(result)
})
app.delete('/watchlist/:id', verifyFirebaseToken, async (req, res)=>{
  const id = req.params.id;

  const query = {_id: new ObjectId(id), email: req.token_email}
  const result = await watchlistCollection.deleteOne(query)
  res.send(result)
})
// genre or rating range filtering

app.get('/movies/filter', async (req, res)=>{
  const {genre, minRatings, maxRatings} = req.query;
  const filter = {}
  if(genre){
    const genreArray = genre.split(',')
    filter.genre = {$in: genreArray}
  }
  
  if(minRatings || maxRatings){
filter.rating = {}
if(minRatings){
  filter.rating.$gte = parseFloat(minRatings)
}
if(maxRatings){
  filter.rating.$lte = parseFloat(maxRatings)
}
  }
  const cursor = moviesCollection.find(filter)
  const result = await cursor.toArray();
  res.send(result)
})


    app.get('/movies/recentlyAdded', async (req, res) => {

      const cursor = moviesCollection.find().sort({ addedAt: -1 }).limit(6)
      const result = await cursor.toArray()
      res.send(result)
    })

    //  user related apis 
    app.post('/users', async (req, res) => {
      const newUser = req.body;
      newUser.role='user'
      const email = newUser.email;
      const query = { email: email }
      const existingUser = await usersCollection.findOne(query)

      if (existingUser) {
        res.send({ message: 'user already exist. do not need to insert again' })
      }
      else {
        const result = await usersCollection.insertOne(newUser)
        res.send(result)
      }

    })

app.get('/users/role', verifyFirebaseToken, async (req, res) => {

    const email = req.query.email;

    if (!email) {
      return res.status(400).send({ message: 'Email is required' });
    }

    const user = await usersCollection.findOne({ email });

    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }

    res.send({ role: user.role });

});


    // movie add 
    app.post('/movies/add', verifyFirebaseToken, async (req, res) => {
      const newMovies = req.body;
      newMovies.addedBy = req.token_email
      newMovies.addedAt = new Date();
    console.log('newMovies', newMovies)
      const result = await moviesCollection.insertOne(newMovies)
    
      res.send(result)
    })

    // state sections api 
    app.get('/stats', async (req, res) => {


      const totalMovies = await moviesCollection.estimatedDocumentCount();
      const totalUsers = await usersCollection.estimatedDocumentCount();
      res.send({ totalMovies, totalUsers });

    });

    // top rated movies apis 
    app.get('/movies/top-rated', async (req, res) => {
      const topRatedMovies = moviesCollection.find();
      const cursor = topRatedMovies.sort({ rating: -1 }).limit(5)
      const result = await cursor.toArray();
      res.send(result)

    })

    app.patch('/movies/update/:id', verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const updatedMovie = req.body;
      const query = { _id: new ObjectId(id) }
      const update = {
        $set: {
          title: updatedMovie.title,
          genre: updatedMovie.genre,
          releaseYear: updatedMovie.releaseYear,
          director: updatedMovie.director,
          cast: updatedMovie.cast,
          language: updatedMovie.language,
          plotSummary: updatedMovie.plotSummary,
          posterUrl: updatedMovie.posterUrl


        }
      }
      const result = await moviesCollection.updateOne(query, update)
      res.send(result)
    }
    )

    // delete movies apis 
    app.delete('/movies/:id', async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) }
      const result = await moviesCollection.deleteOne(query);
      res.send(result)

    })

    // all movies apis 
    app.get('/movies', async (req, res) => {
      const cursor = moviesCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // my collection
    app.get('/movies/my-collection', verifyFirebaseToken,  async (req, res) => {

    
      const email = req.query.email || req.token_email;

      const query = { addedBy: email }
      const cursor = moviesCollection.find(query)
      const result = await cursor.toArray();
      res.send(result)

    })

    // movies apis 
    app.get('/movies/:id', async (req, res) => {
      const id = req.params.id;



      if (ObjectId.isValid(id)) {
        query = { _id: new ObjectId(id) };
      }


      const result = await moviesCollection.findOne(query);
      res.send(result);
    });


    // await client.db('admin').command({ ping: 1 })
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");

  }


  finally {
    //  await client.close();
  }
}
run().catch(console.dir)

app.listen(port, () => {
  console.log(`smart server running on port ${port}`)
})
