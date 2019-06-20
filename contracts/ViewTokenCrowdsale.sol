pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/crowdsale/Crowdsale.sol';
import 'openzeppelin-solidity/contracts/crowdsale/distribution/RefundableCrowdsale.sol';
import 'openzeppelin-solidity/contracts/crowdsale/emission/MintedCrowdsale.sol';
import 'openzeppelin-solidity/contracts/crowdsale/validation/CappedCrowdsale.sol';
import 'openzeppelin-solidity/contracts/crowdsale/validation/TimedCrowdsale.sol';
import 'openzeppelin-solidity/contracts/crowdsale/validation/WhitelistCrowdsale.sol';


contract ViewTokenCrowdsale is Crowdsale, MintedCrowdsale, CappedCrowdsale,
                              TimedCrowdsale, WhitelistCrowdsale, RefundableCrowdsale {
  // Minimum investor total contribution - 0.002 Ether
  uint256 public investorMinCap = 20000000000000000;

  // Maximum investor total contribution - 50 Ether
  uint256 public investorHardCap = 50000000000000000000;

  // Kepp track of contribution for each investor
  mapping(address => uint256) public contributions;

  //  _cap: takes maximum amount of wei accepted
  // _openingTime, _closingTime are unix time
  constructor(
    uint256 _rate,
    address payable _wallet,
    IERC20 _token,
    uint256 _cap,
    uint256 _openingTime,
    uint256 _closingTime,
    uint256 _goal
    )
  Crowdsale(_rate, _wallet, _token)
  CappedCrowdsale(_cap)
  TimedCrowdsale(_openingTime, _closingTime)
  RefundableCrowdsale(_goal)
  public {
    // important!
    require(_goal <= _cap, 'Require goal is less than or equal to cap!');
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
}