pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/crowdsale/Crowdsale.sol';
// import 'openzeppelin-solidity/contracts/crowdsale/distribution/RefundableCrowdsale.sol';
import 'openzeppelin-solidity/contracts/crowdsale/emission/MintedCrowdsale.sol';
import 'openzeppelin-solidity/contracts/crowdsale/validation/CappedCrowdsale.sol';
import 'openzeppelin-solidity/contracts/crowdsale/validation/TimedCrowdsale.sol';
import 'openzeppelin-solidity/contracts/crowdsale/validation/WhitelistCrowdsale.sol';
import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import './override/ViewRefundableCrowdsale.sol';
// import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import './ViewToken.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/TokenTimelock.sol';



contract ViewTokenCrowdsale is Crowdsale, MintedCrowdsale, CappedCrowdsale,
                              TimedCrowdsale, WhitelistCrowdsale, /*RefundableCrowdsale*/ViewRefundableCrowdsale, Ownable {
  // Minimum investor total contribution - 0.002 Ether
  uint256 public investorMinCap = 20000000000000000;

  // Maximum investor total contribution - 50 Ether
  uint256 public investorHardCap = 50000000000000000000;

  // Kepp track of contribution for each investor
  mapping(address => uint256) public contributions;

  // Crowdsale Stages
  enum CrowdsaleStage { PreICO, ICO }
  // Default to presale stage
  CrowdsaleStage public stage = CrowdsaleStage.PreICO;

  // Token Distribution
  uint256 public tokenSalePercentage  = 70;
  uint256 public foundersPercentage   = 10;
  uint256 public foundationPercentage = 10;
  uint256 public partnersPercentage    = 10;

  address public foundersFund;
  address public foundationFund;
  address public partnersFund;

  // Token time lock
  uint256 public releaseTime;
  address public foundersTimelock;
  address public foundationTimelock;
  address public partnersTimelock;

  ViewToken viewToken;

  //  _cap: takes maximum amount of wei accepted
  // _openingTime, _closingTime are unix time
  constructor(
    uint256 _rate,
    address payable _wallet,
    ViewToken _token,
    uint256 _cap,
    uint256 _openingTime,
    uint256 _closingTime,
    uint256 _goal,
    address _foundersAddress,
    address _foundationAddress,
    address _partnersAddress,
    uint256 _releaseTime
    )
  Crowdsale(_rate, _wallet, _token)
  CappedCrowdsale(_cap)
  TimedCrowdsale(_openingTime, _closingTime)
  ViewRefundableCrowdsale(_goal)
  public {
    // important!
    require(_goal <= _cap, 'Require goal is less than or equal to cap!');
    viewToken = _token;

    foundersFund = _foundersAddress;
    foundationFund = _foundationAddress;
    partnersFund = _partnersAddress;

    releaseTime = _releaseTime;
  }

  /**
  * @dev Returns the amount contributed so far by a sepecific user.
  * @param _beneficiary Address of contributor
  * @return User contribution so far
  */
  function getUserContribution(address _beneficiary) public view returns(uint256) {
    return contributions[_beneficiary];
  }

  /**
  * @dev Extend parent behavior requiring purchase to respect investor min/max funding cap.
  * @param _beneficiary Token purchaser
  * @param _weiAmount Amount of wei contributed
  */
  function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal view {
    super._preValidatePurchase(_beneficiary, _weiAmount);
    uint256 _existingContribution = contributions[_beneficiary];
    uint256 _newContribution = _existingContribution.add(_weiAmount);
    require (_newContribution >= investorMinCap &&
             _newContribution <= investorHardCap,
             'Require wei amount to be greater than min cap and less than hard cap!');
  }

  /**
    * @dev Override for extensions that require an internal state to check for validity (current user contributions,
    * etc.)
    * @param _beneficiary Address receiving the tokens
    * @param _weiAmount Value in wei involved in the purchase
    */
  function _updatePurchasingState(address _beneficiary, uint256 _weiAmount) internal {
      contributions[_beneficiary] = contributions[_beneficiary].add(_weiAmount);
  }

  /**
    * @dev add multiple address to the whitelist
    * @param _accounts an array of addreses to be added to the whitelist
    */
  function addAddressesToWhitelist(address[] memory _accounts)
    public
    onlyWhitelistAdmin
  {
      for (uint256 account = 0; account < _accounts.length; account++) {
          addWhitelisted(_accounts[account]);
      }
  }

  /**
    * @dev Allows admin to update the crowdsale stage
    * @param _stage Crowdsale stage
    */
  function setCrowdsaleStage(uint _stage) public onlyOwner {
    if(uint(CrowdsaleStage.PreICO) == _stage) {
      stage = CrowdsaleStage.PreICO;
    }
    else if (uint(CrowdsaleStage.ICO) == _stage) {
      stage = CrowdsaleStage.ICO;
    }
  }

    /**
     * @dev Override how to get token rate based on crowdsale stage
     * @return the number of token units a buyer gets per wei.
     */
    function rate() public view returns (uint256) {
      // Pre sale stage can get more tokens
      if (stage == CrowdsaleStage.PreICO) {
        return 500;
      }
      else if (stage == CrowdsaleStage.ICO) {
        return 250;
      }
    }

    /**
     * @dev Override to extend the way in which ether is converted to tokens.
     * @param weiAmount Value in wei to be converted into tokens
     * @return Number of tokens that can be purchased with the specified _weiAmount
     */
    function _getTokenAmount(uint256 weiAmount) internal view returns (uint256) {
        return weiAmount.mul(rate());
    }

    /**
     * @dev Overrides Crowdsale fund forwarding, sending funds to escrow.
     */
    function _forwardFunds() internal {
      if (stage == CrowdsaleStage.PreICO) {
        wallet().transfer(msg.value);
      }
      else if (stage == CrowdsaleStage.ICO) {
        super._forwardFunds();
      }
    }

    /**
     * @dev Can be overridden to add finalization logic. The overriding function
     * should call super._finalization() to ensure the chain of finalization is
     * executed entirely.
     */
    function _finalization() internal onlyOwner {
      if(goalReached()) {
        // Finish minting the token
        uint256 _alreadyMinted = viewToken.totalSupply();
        uint256 _finalTotalSupply = _alreadyMinted.div(tokenSalePercentage).mul(100);

        foundersTimelock = address(new TokenTimelock(viewToken, foundersFund, releaseTime));
        foundationTimelock = address(new TokenTimelock(viewToken, foundationFund, releaseTime));
        partnersTimelock = address(new TokenTimelock(viewToken, partnersFund, releaseTime));

        viewToken.mint(foundersTimelock, _finalTotalSupply.div(foundersPercentage));
        viewToken.mint(foundationTimelock, _finalTotalSupply.div(foundationPercentage));
        viewToken.mint(partnersTimelock, _finalTotalSupply.div(partnersPercentage));

        // remove crowdsale from minter role
        viewToken.removeMinter(address(this));

        // Unpause the token
        // Allow people to transfer tokens
        viewToken.unpause();
        viewToken.removePauser(address(this));
        // Fill this in
      }
      super._finalization();
    }
}