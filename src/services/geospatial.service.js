const axios = require('axios');

class GeospatialService {
  constructor() {
    this.geocodeApiKey = process.env.GOOGLE_MAPS_API_KEY;
  }

  // Calculate distance between two points using Haversine formula
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  toRad(value) {
    return value * Math.PI / 180;
  }

  async geocodeAddress(address) {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json`,
        {
          params: {
            address: address,
            key: this.geocodeApiKey
          }
        }
      );

      if (response.data.results.length > 0) {
        const result = response.data.results[0];
        return {
          coordinates: [
            result.geometry.location.lng,
            result.geometry.location.lat
          ],
          formattedAddress: result.formatted_address,
          placeId: result.place_id
        };
      }
      throw new Error('No results found');
    } catch (error) {
      throw new Error(`Geocoding failed: ${error.message}`);
    }
  }

  // Find professionals within multiple service areas
  async findProfessionalsInAreas(areas, serviceCategories = []) {
    const professionals = await Professional.aggregate([
      {
        $match: {
          status: 'active',
          ...(serviceCategories.length > 0 && {
            serviceCategories: { $in: serviceCategories }
          })
        }
      },
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: areas[0].coordinates // Primary search area
          },
          distanceField: 'distance',
          maxDistance: areas[0].radius * 1000, // Convert km to meters
          spherical: true
        }
      },
      {
        $addFields: {
          matchedAreas: {
            $size: {
              $filter: {
                input: areas,
                as: 'area',
                cond: {
                  $lte: [
                    '$distance',
                    { $multiply: ['$$area.radius', 1000] }
                  ]
                }
              }
            }
          }
        }
      },
      {
        $match: {
          matchedAreas: { $gt: 0 }
        }
      },
      {
        $sort: {
          matchedAreas: -1,
          distance: 1
        }
      }
    ]);

    return professionals;
  }
}

module.exports = new GeospatialService();