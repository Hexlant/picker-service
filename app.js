const express = require('express');
const session = require('express-session')
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const config = require('./config/config');
const pickerAbi = require('./config/pickerABI');
const request = require('request');

// init web3
const Web3 = require('web3');
const web3 = new Web3(config.getConfig().httpEndpoint + '/v1/ETH/rpc');

// Contract
const pickerContractAddress = config.getConfig().pickerServiceContractAddress;
const pickerContract = new web3.eth.Contract(pickerAbi, pickerContractAddress);

let app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

let token_list = [];
let address;

/*
  Default Route
*/
app.get('/', function(req, res) {
  res.render('index');
});

app.get('/login', function(req, res) {
  res.render('login');
});

app.post('/login', function(req, res) {
  const address = req.param('address');
  const privateKey = req.param('private_key');
  let globalConfig = config.getConfig();
  globalConfig.privateKey = privateKey;
  globalConfig.address = address;
  res.redirect('/');
});

app.get('/api/get_info', async function(req, res) {
  const address = config.getConfig().address;
  const result = await web3.eth.getBalance(address);
  const ether = web3.utils.fromWei(result, 'ether');
  res.json( { balance: ether, address: address});
});

app.post('/api/mint', async function(req, res) {
  let fromAddress = config.getConfig().address;
  let privateKey = config.getConfig().privateKey;
  let toAddress = req.param('to_address');
  let name = req.param('name');

  let nonce = await web3.eth.getTransactionCount(fromAddress, 'pending');
  let gasPrice = web3.utils.toHex(web3.utils.toWei('100', 'gwei'));
  let gasLimit = '200000';
  let inputData = pickerContract.methods.mint(name, toAddress).encodeABI();

  const rawTx = {
    to: pickerContractAddress,
    value: 0,
    gasPrice,
    gas: gasLimit,
    data: inputData,
    nonce: nonce
  };

  if (privateKey.startsWith('0x')) {
    privateKey = privateKey.replace('0x', '');
  }

  let account = web3.eth.accounts.privateKeyToAccount(privateKey);
  let signedTx = await account.signTransaction(rawTx);
  let data = {};

  web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  data.result = 'success';
  res.json(data);
});


app.get('/api/picker', async function(req, res) {
  let numberCount = await pickerContract.methods.numberCount().call();
  if (numberCount == 0) {
    return;
  }
  let randomNumber = await pickerContract.methods.random(numberCount).call();
  randomNumber = randomNumber - 1;

  const name = await pickerContract.methods.numberCards(randomNumber).call();
  const owner = await pickerContract.methods.ownerOf(randomNumber).call();
  res.json({
    name,
    owner
  });
})

app.get('/api/number-count', async function(req, res) {
  const numberCount = await pickerContract.methods.numberCount().call();
  const data = {
    numberCount,
  }
  res.json(data);
});

app.get('/api/number-list', async function(req, res) {
  const numberCount = await pickerContract.methods.numberCount().call();
  const data = [];
  for (let i = 0; i < numberCount; i++) {
    const name = await pickerContract.methods.numberCards(i).call();
    const owner = await pickerContract.methods.ownerOf(i).call();
    data.push({ name, owner });
  };
  res.json(data);
});

app.get('/api/number-count', async function(req, res) {
  const numberCount = await pickerContract.methods.numberCount().call();
  const data = {
    numberCount,
  }
  res.json(data);
});

module.exports = app;
