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

contract('ViewTokenCrowdsale', function([_, wallet, investor1, investor2, investor3]) {

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
    this.goal = ether(50);

    // Investor cap
    this.investorMinCap = ether(0.002);
    this.investorHardCap = ether(50);

    // stages
    this.preIcoStage = 0;
    this.preIcoRate = 500;
    this.icoStage = 1;
    this.icoRate = 250;

    // Token distribution
    this.tokenSalePercentage  = 70;
    this.foundersPercentage   = 10;
    this.foundationPercentage = 10;
    this.parnersPercentage    = 10;

    this.crowdsale = await ViewTokenCrowdsale.new(
      this.rate,
      this.wallet,
      this.token.address,
      this.cap,
      this.openingTime,
      this.closingTime,
      this.goal
    );

    // Pause token
    // We dont want people to transfer the token during the crowdsale
    await this.token.pause();

    // only ViewToken can mint the coin so we
    // need to add minter role to crowdsale to mint the coin
    await this.token.addMinter(this.crowdsale.address);

    await this.token.addPauser(this.crowdsale.address);
    
    // add investors to whitelist
    await this.crowdsale.addAddressesToWhitelist([investor1, investor2]);
    

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
  });
  describe('timed crowdsale', function(){
    it('is open', async function() {
      const isClosed = await this.crowdsale.hasClosed();
      isClosed.should.be.false;
    });
  });

  describe('whiltelisted crowdsale', function(){
    it('rejected contributions from non-whitelisted investors', async function() {
      const nonWhitelisted = _; // first account
      await this.crowdsale.buyTokens(nonWhitelisted, {value: ether(1), from: nonWhitelisted})
      .should.be.rejectedWith(EVMRevert);
    });
  });

  describe('refundable crowdsale', function() {
    beforeEach(async function() {
      await this.crowdsale.buyTokens(investor1, {value: ether(1), from: investor1});
    });
    describe('during crowdsale', function() {
      it('prevents the investor from claiming refund', async function() {
        await this.crowdsale.claimRefund(investor1, {from: investor1})
        .should.be.rejectedWith(EVMRevert);
      });
    });

    describe('when the crowdsale stage is PreICO', function() {
      beforeEach(async function() {
        await this.crowdsale.buyTokens(investor1, {value: ether(1), from: investor1});
      });

      it('forwards funds to the wallet', async function() {
        const balance = await web3.eth.getBalance(this.wallet);
        assert(balance > ether(100));
      });
    });

    describe('when the crowdsale stage is ICO', function() {
      beforeEach(async function() {
        await this.crowdsale.setCrowdsaleStage(this.icoStage, {from: _});
        await this.crowdsale.buyTokens(investor1, {value: ether(1.1), from: investor1});
        
      });

      it('forwards funds to the refund vault', async function() {
        const balance = await this.crowdsale.depositsOf(investor1);
        assert(balance, ether(1.1));
      });
    });

    // describe('when the crowdsale stage is finalized', function() {
    //   beforeEach(async function() {
    //     await this.crowdsale.setCrowdsaleStage(this.icoStage, {from: _});
    //     await this.crowdsale.addAddressesToWhitelist([investor3]);
    //     await this.crowdsale.buyTokens(investor3, {value: ether(1.1), from: investor3});
    //     // Advance time to crowdsale start (add 1 second)
    //     await increaseTimeTo(this.closingTime +1);
    //     await this.crowdsale.finalize();
    //   });

    //   it('forwards funds then claim the refund', async function() {
    //     const balance = await this.crowdsale.depositsOf(investor3);
    //     console.log(balance.toString());

    //     await this.crowdsale.claimRefund(investor3);
    //     const balance2 = await this.crowdsale.depositsOf(investor3);
    //     console.log(balance2.toString());
    //   });
    // });
  });

  describe('crowdsale stages', function() {
    it('it starts in PreICO', async function() {
      const stage = await this.crowdsale.stage();
      stage.toNumber().should.equal(this.preIcoStage);
    });

    it('starts at the openning (deployed) PreIco rate', async function() {
      const rate = await this.crowdsale.rate();
      rate.toNumber().should.be.equal(this.preIcoRate);
    });

    it('allows admin to update the stage and rate', async function() {
      await this.crowdsale.setCrowdsaleStage(this.icoStage, {from: _});
      const stage = await this.crowdsale.stage();
      stage.toNumber().should.equal(this.icoStage);

      const rate = await this.crowdsale.rate();
      rate.toNumber().should.be.equal(this.icoRate);

    });
    it('does not allow not admin to update the stage', async function() {
      await this.crowdsale.setCrowdsaleStage(this.icoStage, {from: investor1})
      .should.be.rejectedWith(EVMRevert);
    });
  });

  describe('token transfer', function() {
    it('does not allow investors to transfer tokens during crowdsale', async function() {
      // Buy some tokens
      await this.crowdsale.buyTokens(investor1, {value: ether(1), from: investor1});

      // Attempt to transfer tokens during crowdsale
      // Try moving 1 token
      await this.token.transfer(investor2, 1, {from: investor1})
      .should.be.rejectedWith(EVMRevert);
    });
  });

  describe('finalizing the crowdsale', function() {
    describe('when the goal is not reached', () => {
      beforeEach(async function(){
        await this.crowdsale.setCrowdsaleStage(this.icoStage, {from: _});

        this.investor2Balance = await web3.eth.getBalance(investor2);

        // Do not meet the goal
        await this.crowdsale.buyTokens(investor2, {value: ether(1), from: investor2});
        
        // Fast forward past end time
        await increaseTimeTo(this.closingTime +1);
        // Finalize the crowdsale
        await this.crowdsale.finalize({from: _ });
      });
      
      it('allows the investor to claim refund', async function() {
        const balance = await this.crowdsale.depositsOf(investor2);
        balance.toString().should.equal(ether(1).toString());

        await this.crowdsale.claimRefund(investor2).should.be.fulfilled;
        const balance2 = await this.crowdsale.depositsOf(investor3);
        balance2.toNumber().should.equal(0);

        // cannot assert ether before and after the refund
        // the value are slightly different due to the gas payment
        this.investor2BalanceAfterRefund = await web3.eth.getBalance(investor2);
        console.log(this.investor2Balance);
        console.log(this.investor2BalanceAfterRefund);
      });
    });

    describe('when the goal is reached', function() {
      beforeEach(async function() {
        this.walletBalance = await web3.eth.getBalance(wallet);
        await this.crowdsale.setCrowdsaleStage(this.icoStage, {from: _});

        // Meet the goal
        await this.crowdsale.buyTokens(investor1, {value: ether(26), from: investor1});
        await this.crowdsale.buyTokens(investor2, {value: ether(26), from: investor2});

        // Fast forward past end time
        await increaseTimeTo(this.closingTime +1);

        const isMinter = await this.token.isMinter(this.crowdsale.address);
        isMinter.should.be.true;

        // Finalize the crowdsale
        await this.crowdsale.finalize({from: _ });
      });
      it('handles goal reached', async function() {
        const goalReached = await this.crowdsale.goalReached();
        goalReached.should.be.true;

        const isMinter = await this.token.isMinter(this.crowdsale.address);
        isMinter.should.be.false;

        // Unpaused the token
        const paused = await this.token.paused();
        paused.should.be.false;

        // Prevents investor from claiming refund
        await this.crowdsale.claimRefund(investor1)
        .should.be.rejectedWith(EVMRevert);
      });
    });

    describe('token distribution', function() {
      it('tracks token distribution correctly', async function() {
        const tokenSalePercentage= await this.crowdsale.tokenSalePercentage();
        tokenSalePercentage.toNumber().should.be.eq(this.tokenSalePercentage, 'has correct tokenSalePercentage');

        const foundersPercentage= await this.crowdsale.foundersPercentage();
        foundersPercentage.toNumber().should.be.eq(this.foundersPercentage, 'has correct foundersPercentage');

        const foundationPercentage= await this.crowdsale.foundationPercentage();
        foundationPercentage.toNumber().should.be.eq(this.foundationPercentage, 'has correct foundationPercentage');

        const parnersPercentage= await this.crowdsale.parnersPercentage();
        parnersPercentage.toNumber().should.be.eq(this.parnersPercentage, 'has correct parnersPercentage');

      });

      it('is a valid perentage breakdown', async function() {
        const tokenSalePercentage= await this.crowdsale.tokenSalePercentage();
        const foundersPercentage= await this.crowdsale.foundersPercentage();
        const foundationPercentage= await this.crowdsale.foundationPercentage();
        const parnersPercentage= await this.crowdsale.parnersPercentage();
        const total = tokenSalePercentage.toNumber() + foundersPercentage.toNumber() +
                      foundationPercentage.toNumber() + parnersPercentage.toNumber()
        total.should.be.equal(100);
      });
    });
  });
});
