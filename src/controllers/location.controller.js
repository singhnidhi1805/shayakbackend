const User = require('../models/user.model');

const addAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { houseNo, street, landmark, city, state, zipCode, isDefault, addressType } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.addresses.length >= 15) {
      return res.status(400).json({ error: 'Maximum address limit reached' });
    }

    // If this is the first address or isDefault is true, update other addresses
    if (isDefault || user.addresses.length === 0) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    user.addresses.push({
      houseNo,
      street,
      landmark,
      city,
      state,
      zipCode,
      isDefault: isDefault || user.addresses.length === 0,
      addressType
    });

    await user.save();
    res.json({ message: 'Address added successfully', addresses: user.addresses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const addressId = req.params.addressId;
    const updateData = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ error: 'Address not found' });
    }

    if (updateData.isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    Object.assign(address, updateData);
    await user.save();

    res.json({ message: 'Address updated successfully', addresses: user.addresses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const addressId = req.params.addressId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // Check if this is the only address or if it's the default address
    const isOnlyAddress = user.addresses.length === 1;
    const wasDefault = address.isDefault;

    // Remove the address
    address.remove();

    // If this was the default address and there are other addresses,
    // make the first remaining address the default
    if (wasDefault && !isOnlyAddress) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.json({ 
      message: 'Address deleted successfully', 
      addresses: user.addresses,
      newDefaultAddressId: wasDefault && !isOnlyAddress ? user.addresses[0]._id : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateCurrentLocation = async (req, res) => {
  try {
    const userId = req.user._id;
    const { latitude, longitude } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        currentLocation: {
          type: 'Point',
          coordinates: [longitude, latitude],
          lastUpdated: new Date()
        }
      },
      { new: true }
    );

    res.json({ message: 'Location updated successfully', currentLocation: user.currentLocation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  addAddress,
  updateAddress,
  deleteAddress,
  updateCurrentLocation
};
