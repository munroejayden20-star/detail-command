VEHICLE PLATE IMAGES — Step 3 of /book configurator
====================================================

Drop one image per size slot into this folder. The booking page will pick
them up automatically on next page load. No code changes needed.

Required filenames (any of jpg / webp / png — first match wins):

  compact.{webp,jpg,png}    →  shown when "Compact" is selected
                               (you wanted: Toyota Prius)

  sedan.{webp,jpg,png}      →  shown when "Sedan" is selected
                               (you wanted: Tesla Model 3 Plaid / Performance)

  suv_truck.{webp,jpg,png}  →  shown when "SUV / Truck" is selected
                               (you wanted: Lamborghini Urus)

  van_xl.{webp,jpg,png}     →  shown when "Van / XL" is selected
                               (you wanted: a real box van)

Recommended specs:
  - Aspect ratio: 16:9 (the plate is masked to that ratio)
  - Resolution:   ~1600 × 900 px is plenty; bigger is wasteful
  - Format:       webp preferred for size, jpg fine for legacy
  - Subject:      car centered, 3/4 view, plain or moody background
                  (the plate already adds dark scrims top + bottom)

If a slot has no file, the configurator shows a small
"Drop a <SIZE> photo" placeholder instead of a broken-image icon, so
the form stays usable while you collect assets.

IP NOTE: Tesla, Toyota, and Lamborghini actively enforce their car
designs. Using a photo on a public commercial booking page can be a
trademark concern. Safer options:
  - Stock photo with editorial / commercial license (Unsplash, Pexels,
    Shutterstock, Adobe Stock)
  - A car you've actually detailed (with the customer's permission)
  - A licensed press image from the manufacturer's media room
