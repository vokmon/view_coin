const ViewToken = artifacts.require('ViewToken');
const ViewTokenCrowdsale = artifacts.require('ViewTokenCrowdsale');

const ether = (n) => new web3.utils.BN(web3.utils.toWei(n.toString(), 'ether'));

const duration = {
  seconds: function (val) { return val; },
  minutes: function (val) { return val * this.seconds(60); },
  hours: function (val) { return val * this.minutes(60); },
  days: function (val) { return val * this.hours(24); },
  weeks: function (val) { return val * this.days(7); },
  years: function (val) { return val * this.days(365); },
};

const latestTime = (new Date).getTime();

module.exports = async function(deployer, network, accounts) {
  const _name = 'View';
  const _symbol = 'VTK';
  const _decimals = 18;

  await deployer.deploy(ViewToken, _name, _symbol, _decimals);
  const deployedToken = await ViewToken.deployed();

  const _rate = 500; // 500 View tokens for 1 ether
  const _wallet = accounts[0]; // TODO replace this with real account
  const _cap = ether(100); // raise only 100 ethers
  const _token = deployedToken.address;
  const _openingTime = latestTime + duration.minutes(1); // will be open in one week time
  const _closingTime = _openingTime + duration.weeks(1); // end in 2 weeks from now
  const _goal = ether(50);
  const _fundersFund = accounts[1]; // TODO replace this with real account
  const _foundationFund = accounts[2]; // TODO replace this with real account
  const _partnersFund = accounts[3]; // TODO replace this with real account
  const _releaseTime = _closingTime + duration.days(1);

  await deployer.deploy(ViewTokenCrowdsale,
    _rate,
    _wallet,
    _token,
    _cap,
    _openingTime,
    _closingTime,
    _goal,
    _fundersFund,
    _foundationFund,
    _partnersFund,
    _releaseTime
  );

  return true; 
};
