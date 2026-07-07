// Set your Mapbox access token
mapboxgl.accessToken = "";


// Initialise map centering directly on Melbourne CBD
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11', // Clean base style so colors pop
    center: [144.9631, -37.8136],
    zoom: 13,
    minZoom: 6,
    maxZoom: 20
});

map.on('load', () => {
    // 1. Set up an empty placeholder GeoJSON data source for the Isochrone shapes
    map.addSource('iso-source', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: []
        }
    });

    // 2. Add the drawing layer styled specifically with the policy color palette
    map.addLayer({
        id: 'iso-layer',
        type: 'fill',
        source: 'iso-source',
        layout: {},
        paint: {
            // Match the color to the 'contour' metric returned from Mapbox (5, 10, or 20)
            'fill-color': [
                'match',
                ['get', 'contour'],
                5, '#10B981',   // 5 Min - Emerald Green
                10, '#F59E0B',  // 10 Min - Amber Yellow
                20, '#EF4444',  // 20 Min - Crimson Red
                '#6B7280'       // Fallback gray
            ],
            'fill-opacity': 0.20, // Clear translucency to keep background street layout legible
            'fill-outline-color': 'rgba(255,255,255,0.5)'
        }
    });

    // 3. Add a clean point marker for the exact origin point clicked by the user
    map.addSource('origin-source', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: []
        }
    });

    map.addLayer({
        id: 'origin-layer',
        type: 'circle',
        source: 'origin-source',
        paint: {
            'circle-radius': 6,
            'circle-color': '#111827',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFFFFF'
        }
    });

    // 1. Create a dynamic source for live Mapbox Tilequery POI data
    map.addSource('osm-pois', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    });

    // 1. Render captured locations using Mapbox's built-in Maki Icons
    map.addLayer({
        id: 'osm-poi-symbols',
        type: 'symbol',
        source: 'osm-pois',
        layout: {
            // Match the Mapbox 'maki' property tag value directly to a sprite name
            'icon-image': [
                'match',
                ['get', 'maki'],
                'cafe', 'cafe',
                'restaurant', 'restaurant',
                'school', 'school',
                'college', 'college',
                'pharmacy', 'pharmacy',
                'grocery', 'grocery',
                'clothing-store', 'clothing-store',
                'hairdresser', 'hairdresser',
                'bakery', 'bakery',
                'alcohol-shop', 'alcohol-shop',
                'shop', 'shop',
                'bus', 'bus',
                'fuel', 'fuel',
                'parking', 'parking',
                'marker' // Fallback icon
            ],
            'icon-size': 1.5,
            'icon-allow-overlap': true
        }
    });

    // 3. Render neat floating text labels right above the circles
    map.addLayer({
        id: 'osm-poi-labels',
        type: 'symbol',
        source: 'osm-pois',
        layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
            'text-size': 12,
            'text-offset': [0, 0.5],
            'text-anchor': 'top'
        },
        // paint: {
        //     'text-color': [
        //         'match',
        //         ['get', 'maki'],
        //         'cafe', '#f0690e',       // Cafes = Orange
        //         'restaurant', '#eb28aa', // Restaurants = Pink
        //         'school', '#4361EE',     // Schools = Blue
        //         'college', '#4361EE',    // Higher Ed = Blue
        //         'pharmacy', '#2EC4B6',   // Medical = Mint
        //         '#7209B7'                // Shops/Other = Purple
        //     ],
        //     'text-halo-color': '#FFFFFF',
        //     'text-halo-width': 1.5
        // }

        paint: {
            'text-color': [
                'match',
                ['get', 'maki'],
                // Cafes & Dining (Warm Tones)
                'cafe', '#f0690e', 'bakery', '#f0690e',
                'restaurant', '#eb28aa', 'fast-food', '#eb28aa',
                'bar', '#7209b7', 'pub', '#7209b7',
                // Essentials (Cool Tones)
                'grocery', '#059669', 'supermarket', '#059669',
                'pharmacy', '#2EC4B6', 'hospital', '#2EC4B6', 'doctor', '#2EC4B6',
                // Infrastructure / Education (Blues/Purples)
                'school', '#4361EE', 'college', '#4361EE', 'university', '#4361EE',
                'bus', '#3a0ca3', 'rail', '#3a0ca3',
                // Default text fallback color
                '#4b5563'
            ],
            'text-halo-color': '#FFFFFF',
            'text-halo-width': 1.5
        }

    });
}); // map loads end

// Add zoom and rotation controls to the top right corner
map.addControl(new mapboxgl.NavigationControl(), 'top-right');

map.on('click', (e) => {
    const turfEngine = window.turf;

    if (!turfEngine) {
        console.error("Turf.js library is still downloading. Please click again in a brief second.");
        return;
    }

    const lng = e.lngLat.lng;
    const lat = e.lngLat.lat;

    const profileSelectEl = document.getElementById('profile-select') || document.getElementById('mode');
    const profile = profileSelectEl.value;

    map.getSource('origin-source').setData({
        'type': 'FeatureCollection',
        'features': [
            {
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [lng, lat]
                },
                'properties': {}
            }
        ]
    });

    const mapboxUrl = 'https://api.mapbox.com/isochrone/v1/mapbox/' + profile + '/' + lng + ',' + lat + '.json?contours_minutes=5,10,20&polygons=true&access_token=' + mapboxgl.accessToken;


    /*
        fetch(mapboxUrl)
            .then(response => response.json())
            .then(isoData => {
                map.getSource('iso-source').setData(isoData);
    
                // Calculate bounding box and extract corners
                const bbox = turfEngine.bbox(isoData);
                const centerPoint = turfEngine.point([lng, lat]);
                const farCornerPoint = turfEngine.point([bbox[2], bbox[3]]);
    
                // Dynamically calculate the search radius in meters to pass to Tilequery
                const calculatedRadius = Math.ceil(turfEngine.distance(centerPoint, farCornerPoint, { units: 'meters' }));
                // Clamp the radius to Mapbox's maximum allowed constraint of 50,000m
                const searchRadius = Math.min(50000, calculatedRadius);
    
                // Target Mapbox Streets v8 vector tileset's 'poi_label' layer
                //const tilesetId = 'mapbox.mapbox-streets-v8';
                //const tilequeryUrl = `https://api.mapbox.com/v4/${tilesetId}/tilequery/${lng},${lat}.json?layers=poi_label&radius=${searchRadius}&limit=50&dedupe=true&access_token=${mapboxgl.accessToken}`;
    
                // By compositing layers, you pull explicit geometry names from multiple sources at once
                const tilesetId = 'mapbox.mapbox-streets-v8';
                const targetLayers = 'poi_label'; // Only ONE layer allowed if limit > 50
                //const targetLayers = 'poi_label,building,transit_stop_label';
    
                const tilequeryUrl = `https://api.mapbox.com/v4/${tilesetId}/tilequery/${lng},${lat}.json?layers=${targetLayers}&radius=${searchRadius}&limit=100&dedupe=true&access_token=${mapboxgl.accessToken}`;
    
                return fetch(tilequeryUrl)
                    .then(res => {
                        if (!res.ok) throw new Error('Tilequery endpoint returned an error: ' + res.status);
                        return res.json();
                    })
                    .then(tilequeryData => {
                        // Filter out intersections matching the spatial geometry footprint of the Isochrone
                        const strictIntersections = turfEngine.pointsWithinPolygon(tilequeryData, isoData);
                        map.getSource('osm-pois').setData(strictIntersections);
    
                        // --- DASHBOARD PROCESSING INFRASTRUCTURE ---
                        const contours = [...isoData.features].reverse();
                        const iso5Polygon = contours[0];
                        const iso10Polygon = contours[1];
                        const iso20Polygon = contours[2];
    
                        let count5 = 0;
                        let count10 = 0;
                        let count20 = 0;
                        const categoryTotals = {};
    
                        
                        strictIntersections.features.forEach(poi => {
                            const props = poi.properties;
                            // Use the normalized 'maki' classification instead of unpredictable raw tags
                            const makiType = props.maki || 'other'; 
    
                            // Assign high-level category buckets for progress tracking rows
                            let group = 'Other Services';
                            if (['cafe', 'restaurant', 'fast_food', 'bar'].includes(makiType)) group = 'Food & Drink';
                            else if (['grocery', 'bakery'].includes(makiType)) group = 'Groceries';
                            else if (['school', 'college', 'university'].includes(makiType)) group = 'Education';
                            else if (['pharmacy', 'hospital'].includes(makiType)) group = 'Health & Wellness';
                            else if (['clothing-store', 'hairdresser', 'shop'].includes(makiType)) group = 'Retail Shopping';
    
                            categoryTotals[group] = (categoryTotals[group] || 0) + 1;
    
                            // Exclusively sort items into their tightest matching polygon layer
                            if (iso5Polygon && turfEngine.booleanPointInPolygon(poi, iso5Polygon)) {
                                count5++;
                            } else if (iso10Polygon && turfEngine.booleanPointInPolygon(poi, iso10Polygon)) {
                                count10++;
                            } else if (iso20Polygon && turfEngine.booleanPointInPolygon(poi, iso20Polygon)) {
                                count20++;
                            }
                        });
                        
    
    
                        // strictIntersections.features.forEach(poi => {
                        //     const props = poi.properties;
                        //     const makiType = props.maki || 'other';
    
                        //     // Define highly granular urban amenity categories
                        //     let group = 'Other Services';
    
                        //     if (['cafe', 'bakery', 'ice-cream', 'teahouse'].includes(makiType)) group = 'Cafes & Bakeries';
                        //     else if (['restaurant', 'fast-food'].includes(makiType)) group = 'Restaurants & Dining';
                        //     else if (['bar', 'pub', 'beer', 'alcohol-shop'].includes(makiType)) group = 'Nightlife & Bars';
                        //     else if (['grocery', 'supermarket', 'convenience'].includes(makiType)) group = 'Supermarkets & Groceries';
                        //     else if (['school', 'college', 'university', 'kindergarten'].includes(makiType)) group = 'Education & Schools';
                        //     else if (['library', 'museum', 'art-gallery', 'theatre', 'cinema'].includes(makiType)) group = 'Arts & Culture';
                        //     else if (['pharmacy', 'hospital', 'doctor', 'dentist', 'clinic'].includes(makiType)) group = 'Medical & Health';
                        //     else if (['park', 'playground', 'dog-park', 'garden'].includes(makiType)) group = 'Parks & Recreation';
                        //     else if (['bus', 'rail', 'rail-metro', 'rail-light', 'ferry'].includes(makiType)) group = 'Public Transit Stops';
                        //     else if (['parking', 'parking-garage'].includes(makiType)) group = 'Parking Spaces';
                        //     else if (['clothing-store', 'hairdresser', 'shop', 'mall', 'laundry', 'bank', 'atm'].includes(makiType)) group = 'Retail & Banking';
    
                        //     categoryTotals[group] = (categoryTotals[group] || 0) + 1;
    
                        //     // Exclusively sort items into their tightest matching polygon layer
                        //     if (iso5Polygon && turfEngine.booleanPointInPolygon(poi, iso5Polygon)) {
                        //         count5++;
                        //     } else if (iso10Polygon && turfEngine.booleanPointInPolygon(poi, iso10Polygon)) {
                        //         count10++;
                        //     } else if (iso20Polygon && turfEngine.booleanPointInPolygon(poi, iso20Polygon)) {
                        //         count20++;
                        //     }
                        // });
    
                        // strictIntersections.features.forEach(poi => {
                        //     const props = poi.properties;
                        //     const makiType = props.maki || 'other';
                        //     // Normalize the name string to lowercase so keyword match tests are bulletproof
                        //     const typeName = (props.name || '').toLowerCase();
    
                        //     // Define highly granular urban amenity categories
                        //     let group = 'Other Services';
    
                        //     if (['cafe', 'bakery', 'ice-cream', 'teahouse'].includes(makiType)) {
                        //         group = 'Cafes & Bakeries';
                        //     }
                        //     // Combined Check: Matches standard restaurant types OR fallback chain brand names
                        //     else if (['restaurant', 'fast-food'].includes(makiType) || typeName.includes('mcdonald') || typeName.includes('kfc')) {
                        //         group = 'Restaurants & Dining';
                        //     }
                        //     else if (['bar', 'pub', 'beer', 'alcohol-shop'].includes(makiType)) {
                        //         group = 'Nightlife & Bars';
                        //     }
                        //     else if (['grocery', 'supermarket', 'convenience'].includes(makiType)) {
                        //         group = 'Supermarkets & Groceries';
                        //     }
                        //     else if (['school', 'college', 'university', 'kindergarten'].includes(makiType)) {
                        //         group = 'Education & Schools';
                        //     }
                        //     else if (['library', 'museum', 'art-gallery', 'theatre', 'cinema'].includes(makiType)) {
                        //         group = 'Arts & Culture';
                        //     }
                        //     else if (['pharmacy', 'hospital', 'doctor', 'dentist', 'clinic'].includes(makiType)) {
                        //         group = 'Medical & Health';
                        //     }
                        //     else if (['park', 'playground', 'dog-park', 'garden'].includes(makiType)) {
                        //         group = 'Parks & Recreation';
                        //     }
                        //     // Combined Check: Matches standard transit keys OR local service station brands (BP, Shell)
                        //     else if (['bus', 'rail', 'rail-metro', 'rail-light', 'ferry', 'fuel', 'gas_station'].includes(makiType) || typeName.includes('bp') || typeName.includes('shell')) {
                        //         group = 'Public Transit Stops'; // This group now catches the fuel stations too!
                        //     }
                        //     else if (['parking', 'parking-garage'].includes(makiType)) {
                        //         group = 'Parking Spaces';
                        //     }
                        //     else if (['clothing-store', 'hairdresser', 'shop', 'mall', 'laundry', 'bank', 'atm'].includes(makiType)) {
                        //         group = 'Retail & Banking';
                        //     }
    
                        //     categoryTotals[group] = (categoryTotals[group] || 0) + 1;
    
                        //     // Exclusively sort items into their tightest matching polygon layer
                        //     if (iso5Polygon && turfEngine.booleanPointInPolygon(poi, iso5Polygon)) {
                        //         count5++;
                        //     } else if (iso10Polygon && turfEngine.booleanPointInPolygon(poi, iso10Polygon)) {
                        //         count10++;
                        //     } else if (iso20Polygon && turfEngine.booleanPointInPolygon(poi, iso20Polygon)) {
                        //         count20++;
                        //     }
                        // });
    
                        // --- DOM INJECTION RENDERING ---
                        document.getElementById('score-block')?.classList.remove('hidden');
                        document.getElementById('category-panel')?.classList.remove('hidden');
    
                        if (document.getElementById('count-5min')) document.getElementById('count-5min').innerText = `${count5} amenities inside buffer`;
                        if (document.getElementById('count-10min')) document.getElementById('count-10min').innerText = `${count10} amenities inside buffer`;
                        if (document.getElementById('count-20min')) document.getElementById('count-20min').innerText = `${count20} amenities inside buffer`;
                        if (document.getElementById('dash-total')) document.getElementById('dash-total').innerText = `${strictIntersections.features.length} AMENITIES Found`;
    
                        const displayProfile = profile === 'walking' ? '🚶 Walking' : '🚴 Cycling';
                        if (document.getElementById('dash-profile')) document.getElementById('dash-profile').innerText = displayProfile;
    
                        const totalPOIs = strictIntersections.features.length;
                        const computedScore = Math.min(100, Math.round((count5 * 5) + (count10 * 2.5) + (count20 * 1)));
                        if (document.getElementById('score-number')) document.getElementById('score-number').innerText = computedScore;
    
                        if (document.getElementById('score-summary')) {
                            document.getElementById('score-summary').innerText = `Your location offers access to ${totalPOIs} local amenities within 20 mins using the ${profile} mode.`;
                        }
    
                        const listContainer = document.getElementById('categories-list');
                        if (listContainer) {
                            listContainer.innerHTML = '';
    
                            Object.entries(categoryTotals)
                                .sort((a, b) => b[1] - a[1])
                                .forEach(([categoryName, quantity]) => {
                                    const maxValForWidth = Math.max(...Object.values(categoryTotals));
                                    const percentageWidth = (quantity / maxValForWidth) * 100;
    
                                    const rowHtml = `
                                    <div class="category-row" style="margin-bottom: 12px;">
                                        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px; font-weight:500; color:#333;">
                                            <span>${categoryName}</span>
                                            <span>${quantity}</span>
                                        </div>
                                        <div class="progress-bar-bg" style="background:#e2e8f0; height:8px; border-radius:4px; width:100%; overflow:hidden;">
                                            <div class="progress-bar-fill" style="background:#3182ce; height:100%; width:${percentageWidth}%;"></div>
                                        </div>
                                    </div>
                                `;
                                    listContainer.insertAdjacentHTML('beforeend', rowHtml);
                                });
                        }
                    });
            })
            .catch(error => {
                console.error('Error executing combined Spatial live-tracking data loop:', error);
            });
    
    */

    // 1. Fetch your Isochrone travel boundary polygons as usual
    fetch(mapboxUrl)
        .then(response => response.json())
        .then(isoData => {
            map.getSource('iso-source').setData(isoData);

            // Fit the camera bounds so the entire 20-minute polygon tiles load into your browser memory
            const bbox = turfEngine.bbox(isoData);
            map.fitBounds(bbox, { padding: 40, animate: false });

            // 2. THE BYPASS: Query the loaded map tiles directly (No 50-limit rule!)
            const featuresInViewport = map.querySourceFeatures('composite', {
                sourceLayer: 'poi_label'
            });

            // Convert the raw cached array into a clean GeoJSON FeatureCollection for Turf.js
            const rawPoiData = turfEngine.featureCollection(featuresInViewport);

            // 3. Filter points to only count what falls inside your travel polygon zones
            const strictIntersections = turfEngine.pointsWithinPolygon(rawPoiData, isoData);

            // Deduplicate features (since vector tiles naturally repeat features along tile seam lines)
            const uniqueFeatures = [];
            const seenIds = new Set();

            strictIntersections.features.forEach(f => {
                const id = f.properties.id || f.id || `${f.geometry.coordinates[0]}-${f.geometry.coordinates[1]}`;
                if (!seenIds.has(id)) {
                    seenIds.add(id);
                    uniqueFeatures.push(f);
                }
            });
            strictIntersections.features = uniqueFeatures;

            // Render the filtered collection points to your map display layer
            map.getSource('osm-pois').setData(strictIntersections);

            // --- DASHBOARD PROCESSING INFRASTRUCTURE ---
            const contours = [...isoData.features].reverse();
            const iso5Polygon = contours[0];
            const iso10Polygon = contours[1];
            const iso20Polygon = contours[2];

            let count5 = 0;
            let count10 = 0;
            let count20 = 0;
            const categoryTotals = {};

            strictIntersections.features.forEach(poi => {
                const props = poi.properties;
                const makiType = props.maki || 'other';
                const typeName = (props.name || '').toLowerCase();

                // 1. FILTER CLEANUP: Skip generic single-letter campus blocks and nameless structures
                if (typeName.length <= 2 || makiType === 'building' || makiType === 'marker') {
                   
                    return; // Exit this iteration immediately and skip to the next feature
                }
                console.log(props.name);
                
                let group = 'Other Services';

                if (['cafe', 'bakery', 'ice-cream', 'teahouse'].includes(makiType)) {
                    group = 'Cafes & Bakeries';
                }
                else if (['restaurant', 'fast-food'].includes(makiType) || typeName.includes('mcdonald') || typeName.includes('kfc')) {
                    group = 'Restaurants & Dining';
                }
                else if (['bar', 'pub', 'beer', 'alcohol-shop'].includes(makiType)) {
                    group = 'Nightlife & Bars';
                }
                else if (['grocery', 'supermarket', 'convenience'].includes(makiType)) {
                    group = 'Supermarkets & Groceries';
                }
                else if (['school', 'college', 'university', 'kindergarten'].includes(makiType)) {
                    group = 'Education & Schools';
                }
                else if (['library', 'museum', 'art-gallery', 'theatre', 'cinema'].includes(makiType)) {
                    group = 'Arts & Culture';
                }
                else if (['pharmacy', 'hospital', 'doctor', 'dentist', 'clinic'].includes(makiType)) {
                    group = 'Medical & Health';
                }
                else if (['park', 'playground', 'dog-park', 'garden'].includes(makiType)) {
                    group = 'Parks & Recreation';
                }
                else if (['bus', 'rail', 'rail-metro', 'rail-light', 'ferry', 'fuel', 'gas_station'].includes(makiType) || typeName.includes('bp') || typeName.includes('shell')) {
                    group = 'Public Transit Stops';
                }
                else if (['parking', 'parking-garage'].includes(makiType)) {
                    group = 'Parking Spaces';
                }
                else if (['clothing-store', 'hairdresser', 'shop', 'mall', 'laundry', 'bank', 'atm'].includes(makiType)) {
                    group = 'Retail & Banking';
                }

                categoryTotals[group] = (categoryTotals[group] || 0) + 1;

                if (iso5Polygon && turfEngine.booleanPointInPolygon(poi, iso5Polygon)) {
                    count5++;
                } else if (iso10Polygon && turfEngine.booleanPointInPolygon(poi, iso10Polygon)) {
                    count10++;
                } else if (iso20Polygon && turfEngine.booleanPointInPolygon(poi, iso20Polygon)) {
                    count20++;
                }
            });

            // --- DOM INJECTION RENDERING ---
            document.getElementById('score-block')?.classList.remove('hidden');
            document.getElementById('category-panel')?.classList.remove('hidden');

            if (document.getElementById('count-5min')) document.getElementById('count-5min').innerText = `${count5} amenities inside buffer`;
            if (document.getElementById('count-10min')) document.getElementById('count-10min').innerText = `${count10} amenities inside buffer`;
            if (document.getElementById('count-20min')) document.getElementById('count-20min').innerText = `${count20} amenities inside buffer`;
            if (document.getElementById('dash-total')) document.getElementById('dash-total').innerText = `${strictIntersections.features.length} AMENITIES Found`;

            const displayProfile = profile === 'walking' ? '🚶 Walking' : '🚴 Cycling';
            if (document.getElementById('dash-profile')) document.getElementById('dash-profile').innerText = displayProfile;

            const totalPOIs = strictIntersections.features.length;
            const computedScore = Math.min(100, Math.round((count5 * 5) + (count10 * 2.5) + (count20 * 1)));
            if (document.getElementById('score-number')) document.getElementById('score-number').innerText = computedScore;

            if (document.getElementById('score-summary')) {
                document.getElementById('score-summary').innerText = `Your location offers access to ${totalPOIs} local amenities within 20 mins using the ${profile} mode.`;
            }

            const listContainer = document.getElementById('categories-list');
            if (listContainer) {
                listContainer.innerHTML = '';
                Object.entries(categoryTotals)
                    .sort((a, b) => b[1] - a[1])
                    .forEach(([categoryName, quantity]) => {
                        const maxValForWidth = Math.max(...Object.values(categoryTotals));
                        const percentageWidth = (quantity / maxValForWidth) * 100;

                        const rowHtml = `
                    <div class="category-row" style="margin-bottom: 12px;">
                        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px; font-weight:500; color:#333;">
                            <span>${categoryName}</span>
                            <span>${quantity}</span>
                        </div>
                        <div class="progress-bar-bg" style="background:#e2e8f0; height:8px; border-radius:4px; width:100%; overflow:hidden;">
                            <div class="progress-bar-fill" style="background:#3182ce; height:100%; width:${percentageWidth}%;"></div>
                        </div>
                    </div>`;
                        listContainer.insertAdjacentHTML('beforeend', rowHtml);
                    });
            }
        })
        .catch(error => {
            console.error('Error executing combined Spatial live-tracking data loop:', error);
        });

});
