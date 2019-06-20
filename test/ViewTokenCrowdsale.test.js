import ether from './helper/ether';
import EVMRevert from './helper/EVMRevert';
import {increaseTime, duration, increaseTimeTo} from './helper/increaseTime';
import latestTime from './helper/latestTime';

const BigNumber = web3.BigNumber;
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const ViewToken = artifacts.require('ViewToken');
const ViewTokenCrowdsale = artifacts.require('ViewTokenCrowdsale');

contract('ViewTokenCrowdsale', function([_, wallet, investor1, investor2]) {

  beforeEach(async function() {

    // this.token = await ViewToken.deployed();
    // this.crowdsale = await ViewTokenCrowdsale.deployed();


    const latest = await latestTime();

    // Token config
    this.name = 'View';
    this.symbol = 'VTK';
    this.decimals = 18;
    this.token = await ViewToken.new(
      this.name,
      this.symbol,
      this.decimals);
    
    // Token crowdsale config
    this.rate = 500; // 500 View tokens for 1 ether
    this.wallet = wallet;
    this.cap = ether(100); // raise only 100 ethers
    this.openingTime = latest + duration.weeks(1); // will be open in one week time
    this.closingTime = this.openingTime + duration.weeks(1); // end in 2 weeks from now

    // Investor cap
    this.investorMinCap = ether(0.002);
    this.investorHardCap = ether(50);

    this.crowdsale = await ViewTokenCrowdsale.new(
      this.rate,
      this.wallet,
      this.token.address,
      this.cap,
      this.openingTime,
      this.closingTime
    );

    // only ViewToken can mint the coin so we
    // need to add minter role to crowdsale to mint the coin
    await this.token.addMinter(this.crowdsale.address);

    // Advance time to crowdsale start (add 1 second)
    await increaseTimeTo(this.openingTime + 1);
  });

  describe('crowdsale', function() {
    it('tracks the token', async function() {
      const token = await this.crowdsale.token();
      token.should.equal(this.token.address);
    });

    it('tracks the rate', async function() {
      const rate = await this.crowdsale.rate();
      rate.toNumber().should.equal(this.rate);
    });

    it('tracks the wallet', async function() {
      const wallet = await this.crowdsale.wallet();
      wallet.should.equal(this.wallet);
    });
  });
  
  describe('minted crowdsale', function() {
    it('mints tokens after purchase', async function() {
      const originalTotalSupply = await this.token.totalSupply();
      await this.crowdsale.sendTransaction({value: ether(1), from: investor1});
      const newTotalSupply = await this.token.totalSupply();
      assert.isTrue(originalTotalSupply < newTotalSupply);
    });
  });

  describe('accepting payments', function() {
    it('should accept payments', async function() {
      const value = ether(1);
      await this.crowdsale.sendTransaction({ value, from: investor1})
      .should.be.fulfilled;

      // investor1 buy tokens on behalf of purchaser
      const purchaser = investor2;
      await this.crowdsale.buyTokens(investor1, {value, from: purchaser})
      .should.be.fulfilled;
    });
  });

  describe('capped crowdsale', async function() {
    it('has the correct hard cap', async function() {
      const cap = await this.crowdsale.cap();
      assert(cap, this.cap);
    });
  });

  describe('buyTokens()', function() {
    describe('when the contribution is less than the minimum cap', function() {
      it('reject the transaction', async function() {
        const value = this.investorMinCap - 1;
        await this.crowdsale.buyTokens(investor2, {value, from: investor2})
        .should.be.rejectedWith(EVMRevert);
      });
    });

    describe('when the investor has already met the minimum cap', function() {
      it('allows the investor to contribute below the minimum cap', async function() {

        // First contribution is valid
        const value1 = ether(1);
        await this.crowdsale.buyTokens(investor1, {value: value1, from: investor1});

        // Second contribution is less than investor maximum cap
        const value2 = ether(1);
        await this.crowdsale.buyTokens(investor1, {value: value2, from: investor1});
      });
    });

    describe('when the total contributions exceed the investor hard cap', function() {
      it('rejects the transaction', async function() {
        // First contribution is in valid range
        const value1 = ether(2);
        await this.crowdsale.buyTokens(investor1, {value: value1, from: investor1});

        // Second contribution sends total contributions over investor hard cap
        const value2 = ether(49);
        await this.crowdsale.buyTokens(investor1, {value: value2, from: investor1})
        .should.be.rejectedWith(EVMRevert);
      });
    });

    describe('when the contribution is within the valid range', function() {
      it('succeeds and updates the contribution amount', async function(){
        const value = ether(2);
        await this.crowdsale.buyTokens(investor2, {value: value, from: investor2}).should.be.fulfilled;

        const contribution = await this.crowdsale.getUserContribution(investor2);
        assert(contribution, value);
      });
    });

    describe('timed crowdsale', function(){
      it('is open', async function() {
        const isClosed = await this.crowdsale.hasClosed();
        isClosed.should.be.false;
      });
    });
  });
});
