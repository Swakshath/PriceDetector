const express = require('express');
const router = express.Router();
const cheerio = require('cheerio');
const { Cluster } = require('puppeteer-cluster');
const {OAuth2Client} = require('google-auth-library');
const connection = require('../connection.js')
const webpush = require('web-push')
const vanillaPuppeteer = require('puppeteer')
const { addExtra } = require('puppeteer-extra')
const Stealth =  require("puppeteer-extra-plugin-stealth")
const Recaptcha = require("puppeteer-extra-plugin-recaptcha")
const dotenv = require('dotenv');
dotenv.config();

const puppeteer = addExtra(vanillaPuppeteer)
  puppeteer.use(Stealth())
  puppeteer.use(Recaptcha())

var db = connection.getDb();

const client = new OAuth2Client(`${process.env.CLIENT_ID}.apps.googleusercontent.com`);
async function verify(token) {
  const ticket = await client.verifyIdToken({
      idToken: token,
      audience: `${process.env.CLIENT_ID}.apps.googleusercontent.com`,  // Specify the CLIENT_ID of the app that accesses the backend
      // Or, if multiple clients access the backend:
      //[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
  });
  const payload = ticket.getPayload();
  const userid = payload['sub'];
  return payload
  // If request specified a G Suite domain:
  // const domain = payload['hd'];
}



router.get('/', function(req, res){
    res.render('homepage')
})

router.post('/addprod', async function(req, res){
    console.log('in')
    console.log(req.body.produrl)

    const cluster = await Cluster.launch({
      puppeteer, 
    puppeteerOptions: {
      headless: false
  },
        //parallel browsers
        concurrency: Cluster.CONCURRENCY_PAGE,
        //Task count to be executed concurrently
        maxConcurrency: 200000,
        

      });
      var userid = req.session.userid;
      var url = req.body.produrl;
      cluster.queue(url);
      /*db.collection('Products').count({userid:req.session.userid, produrl:req.body.produrl}, function(err, result){
          if(result==0)
          {
            db.collection('Products').insertOne({userid:userid, produrl:req.body.produrl, price:req.body.price})
          }
      })*/
      
        await cluster.task(async ({ page, data:url  }) => {
            await page.goto(url);
            const html = await page.content();
            const $ = cheerio.load(html)

            if(url.match('https://www.amazon.in'))
            {
                var nowprice = $('span[id="priceblock_ourprice"]').text()
                if(nowprice=="") {
                    nowprice = $('span[id="priceblock_dealprice"]').text()
                }
                if(nowprice=="")
                {
                  res.send("0")
                }
                else {
                    nowprice = parseFloat(nowprice.replace(/[^0-9\.-]+/g,""))
                    console.log(nowprice)
                    
                    var prodtitlea=$('span[id="productTitle"]').text()
                    prodtitlea=prodtitlea.replace(/\n/g, '')
                    var prodimg = $('div[class="imgTagWrapper"] img').attr('src')
                    console.log('Imglink:'+prodimg)
                    console.log('title'+prodtitlea)
                    res.json({nowprice:nowprice,prodtitle:$('span[id="productTitle"]').text(), prodimg:prodimg, produrl:url });
                    db.collection('Products').count({userid:req.session.userid, produrl:req.body.produrl}, function(err, result){
                      if(result==0)
                      {
                        db.collection('Products').insertOne({userid:userid, produrl:req.body.produrl, price:req.body.price, nowprice:nowprice, prodtitle:prodtitlea, prodimg:prodimg})
                      }
                  })
                }
              }

              else if(url.match('https://www.flipkart.com'))
              {
                console.log('OVER HERE')
                var nowprice = $('div[class="_30jeq3 _16Jk6d"]').text()
                nowprice = parseFloat(nowprice.replace(/[^0-9\.-]+/g,""))
                console.log(nowprice)
                
                var prodtitlea=$('span[class="B_NuCI"]').text()
                var prodimg = $('img[class="_396cs4 _2amPTt _3qGmMb  _3exPp9"]').attr('src')
                prodtitlea.replace(/\n/g, '')
                console.log('title'+prodtitlea)
                res.json({nowprice:nowprice,prodtitle:$('span[class="B_NuCI"]').text(), prodimg:prodimg, produrl:url });
                db.collection('Products').count({userid:req.session.userid, produrl:req.body.produrl}, function(err, result){
                  if(result==0)
                  {
                    db.collection('Products').insertOne({userid:userid, produrl:req.body.produrl, price:req.body.price, nowprice:nowprice, prodtitle:prodtitlea, prodimg:prodimg})
                  }
              })
                
              }

              else
              {
                res.send('0')
              }

    });
      
        await cluster.idle()
        await cluster.close()
        
})

router.post('/onlogin', async function(req, res){
    //console.log('okk')
    var userdata = await verify(req.body.idToken).catch(console.error)
    //console.log((userdata))
    req.session.userid = (userdata['sub']).toString();
    db.collection('Users').count({"userid":userdata['sub']}, function(err, result){

        if(result==0) {
            db.collection('Users').insertOne({userid:userdata['sub'], username:userdata['name'] })
        }

        req.session.username = userdata['name'];
        req.session.propic = userdata['picture'];
        res.send('verified')
    })
    console.log('User logged in')
})

router.get('/userhome', function(req, res){
    db.collection('Products').find({userid:req.session.userid}).toArray(function(err, result){
      
      res.render('userhome', {proddetails:result})
    })
    
})

const publicVapidKey = "BFvW3oEpFfe3-B7X8FEnTTkEqHj0ccQYZcJSudty5n2GqizdJV8Wpcf4LhRv1bUMgRIfyPpdoCywcDD3ojaMFnM";
const privateVapidKey = `${process.env.PRIVATE_VAPID_KEY}`;

webpush.setVapidDetails(
    `mailto:${process.env.MAIL_ID}`,
    publicVapidKey,
    privateVapidKey
  );
  
  // Subscribe Route
  router.post("/subscribe", (req, res) => {
    // Get pushSubscription object
    const subscription = req.body;
  
    // Send 201 - resource created
    res.status(201).json({});
  
    // Pass object into sendNotification
    console.log(JSON.stringify(req.body))

    console.log(req.session.userid)
    
    const payload = JSON.stringify({ title: "Push Test" });

    
      db.collection('ServiceWorkers').count({userid:req.session.userid, deviceid: req.body}, function(err, res){
        if(res==0)
        {
        db.collection('ServiceWorkers').insertOne({userid:req.session.userid, deviceid: req.body},  function(err, res){
            console.log('updated')
        })
    }
    })

  })

  router.post("/deleteprod", function(req, res){
    console.log("deleteign")
    var myquery = {produrl:req.body.produrl, userid:req.body.userid}
    console.log(myquery)
    db.collection('Products').deleteOne({produrl:req.body.produrl, userid:req.body.userid}, function(err, obj) {
      if (err) throw err;
      console.log(obj);
    });
    res.send("done");
  })

    router.post("/updateprodprice", function(req, res){
      var myquery = {produrl:req.body.url, userid:req.session.userid}
      var newvalues = { $set: {price:req.body.price} }
      db.collection('Products').updateOne(myquery, newvalues);
      res.send("done")
    })


module.exports = router;