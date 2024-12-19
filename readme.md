# Correct way to calculate area and length in Openlayers

Openlayers has a built in function to calculate area and length of a polygon or line. However, the calculations are not exact.

To Overcome this, we can use the Geodesic calculations from the [GeographicLib](https://geographiclib.sourceforge.io/html/js/index.html) library.

## How to use

1. Clone the repository
2. Install the dependencies using `npm i`
3. Run the code using `npm run start`