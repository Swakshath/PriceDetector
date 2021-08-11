const express = require('express');
const notify = express.Router();
const cheerio = require('cheerio');
const { Cluster } = require('puppeteer-cluster');
const connection = require('../connection.js')
const webpush = require('web-push');
const vanillaPuppeteer = require('puppeteer')
const { addExtra } = require('puppeteer-extra')
const Stealth =  require("puppeteer-extra-plugin-stealth")
const Recaptcha = require("puppeteer-extra-plugin-recaptcha")

var db = connection.getDb();

async function sendnotifs() {
  const puppeteer = addExtra(vanillaPuppeteer)

  puppeteer.use(Stealth())
  puppeteer.use(Recaptcha())
  const cluster = await Cluster.launch({
    puppeteer, 
    puppeteerOptions: {
      headless: false
  },
    concurrency: Cluster.CONCURRENCY_PAGE,
    maxConcurrency: 10,
    timeout:200000

  });

  async function asyncFunction(result) {
    await cluster.execute(result)
}



  await cluster.task(async ({ page, data: data}) => {
    page.setDefaultNavigationTimeout(0) 
    await page.goto(data.produrl, {
      waitUntil: 'load',
      // Remove the timeout
      timeout: 0});
    const html = await page.content();
    const $ = cheerio.load(html)
      var nowprice, prodtitle
    if((data.produrl).match('https://www.amazon.in'))
    {
          console.log($('span[id="priceblock_dealprice"]').text())
          nowprice = $('span[id="priceblock_ourprice"]').text()
          if(nowprice=="") {
              nowprice = $('span[id="priceblock_dealprice"]').text()
          }
          console.log(nowprice)
          //console.log(html)
          nowprice = (parseFloat(nowprice.replace(/[^0-9\.-]+/g,""))).toString()

          console.log(nowprice)
          if(nowprice == 'NaN')
          {
            nowprice = "Currently Unavailabe"
          }
          prodtitle = $('span[id="productTitle"]').text();
    
    }

    else if((data.produrl).match('https://www.flipkart.com'))
    {
        console.log($('span[id="priceblock_dealprice"]').text())
        nowprice = $('div[class="_30jeq3 _16Jk6d"]').text()
          console.log(nowprice)
          //console.log(html)
          nowprice = (parseFloat(nowprice.replace(/[^0-9\.-]+/g,""))).toString()

          console.log(nowprice)
          if(nowprice == 'NaN')
          {
            nowprice = "Currently Unavailabe"
          }
          prodtitle=$('span[class="B_NuCI"]').text()
          prodtitle.replace(/\n/g, '')
    }
          var myquery = { produrl: data.produrl };
          var newvalues = { $set: {nowprice:nowprice} };
    
    db.collection('Products').updateOne(myquery, newvalues);
    console.log(parseFloat(data.price))
    if(nowprice!="Currently Unavailable")
    {
      if(parseFloat(data.price)>=nowprice)
      {
        db.collection('ServiceWorkers').findOne({userid:data.userid}, function(err, result){
        const payload = JSON.stringify({title:prodtitle, price:nowprice,prodimg:data.prodimg })
        webpush
        .sendNotification(result.deviceid, payload)
        .catch(err => console.error(err));
        })
      }
  }
    

})

db.collection('Products').find({}).toArray(async function(err, result){

        console.log(result)    
        const promises = result.map(asyncFunction)
        await Promise.all(promises)
        console.log(`All async tasks complete!`)
        await cluster.idle()
        await cluster.close().then(console.log('Closed chromium'))

        setTimeout(sendnotifs, 86400000)

      
        
    });

}

//setTimeout(sendnotifs, 2000000);
sendnotifs();


module.exports = notify;