document.addEventListener('DOMContentLoaded', () => {
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // Fetch live stats
    function fetchDashboardStats() {
        fetch('/api/stats/')
            .then(r => r.json())
            .then(data => {
                const statCards = document.querySelectorAll('.stat-card h3');
                if(statCards.length >= 3) {
                    statCards[0].textContent = data.food_saved + ' kg';
                    statCards[1].textContent = data.people_fed;
                    statCards[2].textContent = data.active_volunteers;
                }
            }).catch(err => console.error("Error fetching stats:", err));
    }
    fetchDashboardStats();
    setInterval(fetchDashboardStats, 30000);

    // Navigation logic
    const navItems = document.querySelectorAll('.nav-links li');
    const sections = document.querySelectorAll('.section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');

            // Remove active class from all nav items
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Add active class to clicked item
            item.classList.add('active');

            // Hide all sections
            sections.forEach(sec => sec.classList.remove('active'));

            // Show corresponding section
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Add interactivity to map points (Optional demo interactions)
    const mapPoints = document.querySelectorAll('.map-point');
    mapPoints.forEach(point => {
        point.addEventListener('click', (e) => {
            // Just a simple demo interaction
            point.style.transform = 'scale(1.2)';
            setTimeout(() => {
                point.style.transform = 'scale(1)';
            }, 200);
            
            // Log for demo purposes
            console.log("Clicked point:", point.getAttribute('title'));
        });
    });

    // Toast logic injected here
    function showToast(iconHtml, title, message) {
        const container = document.getElementById('toast-container');
        if(!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast-msg';
        toast.innerHTML = `
            <div class="toast-icon" style="color: var(--primary);">${iconHtml}</div>
            <div>
                <h5 style="margin-bottom: 3px; font-size: 0.95rem;">${title}</h5>
                <p style="font-size: 0.8rem; color: #cbd5e1;">${message}</p>
            </div>
        `;
        container.appendChild(toast);
        
        // Trigger reflow
        void toast.offsetWidth;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 500);
        }, 5000);
    }

    // Trigger random smart notifications for demo
    setTimeout(() => {
        showToast('<i class="fa-solid fa-bell"></i>', 'Opportunity Nearby', 'A new High-Urgency needy location was marked 2km away.');
    }, 15000);

    // Image Browse & AI Scanner Logic
    const fileInput = document.getElementById('food-photo-input');
    const aiOverlay = document.getElementById('ai-scanner-overlay');
    const aiResult = document.getElementById('ai-result-tag');
    const previewImg = document.getElementById('food-preview-img');
    const iconMain = document.getElementById('upload-icon-main');
    const textMain = document.getElementById('upload-text-main');
    const subtextMain = document.getElementById('upload-subtext-main');

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if(e.target.files.length > 0) {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = function(evt) {
                    previewImg.src = evt.target.result;
                    previewImg.style.display = 'block';
                    iconMain.style.display = 'none';
                    textMain.style.display = 'none';
                    subtextMain.style.display = 'none';
                    
                    // Start AI Scan
                    aiOverlay.style.display = 'flex';
                    aiResult.style.display = 'none';
                    
                    setTimeout(() => {
                        aiOverlay.style.display = 'none';
                        aiResult.innerHTML = '<i class="fa-solid fa-check-circle"></i> Fresh Food Detected (98%)';
                        aiResult.style.display = 'block';
                        showToast('<i class="fa-solid fa-robot"></i>', 'AI Validation Complete', 'Food marked as fresh and verified.');
                    }, 2500); // Simulate processing delay
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Initialize Dashboard Leaflet Map strictly centered on India
    let dashboardMap;
    const mapPlaceholder = document.getElementById('dashboard-map');
    if(mapPlaceholder) {
        const indiaBounds = L.latLngBounds([6.4626, 68.1097], [35.5133, 97.3953]);
        
        dashboardMap = L.map('dashboard-map', {
            center: [20.5937, 78.9629],
            zoom: 5,
            minZoom: 4,
            maxBounds: indiaBounds,
            maxBoundsViscosity: 1.0
        });
        
        // Professional CartoDB Voyager map layer (Free high-end map)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
        }).addTo(dashboardMap);
        
        const highNeedIcon = L.divIcon({ className: 'custom-leaflet-dest bounce-icon marker-red', html: '<i class="fa-solid fa-location-dot"></i>' });
        const medNeedIcon = L.divIcon({ className: 'custom-leaflet-dest bounce-icon marker-green', html: '<i class="fa-solid fa-location-dot"></i>' });
        const lowNeedIcon = L.divIcon({ className: 'custom-leaflet-dest bounce-icon marker-yellow', html: '<i class="fa-solid fa-location-dot"></i>' });
        
        let markerClusterGroup = null;
        let mapRadiusCircle = null;

        window.fetchLocationsAndRenderMap = function() {
            if(!dashboardMap) return;
            fetch('/api/locations/')
            .then(r => r.json())
            .then(data => {
                const results = data.results || data;
                if(markerClusterGroup) {
                    markerClusterGroup.clearLayers();
                } else {
                    markerClusterGroup = L.markerClusterGroup({
                        spiderfyOnMaxZoom: true,
                        showCoverageOnHover: false,
                        zoomToBoundsOnClick: true
                    });
                    dashboardMap.addLayer(markerClusterGroup);
                }

                const filterUrgency = document.getElementById('map-filter-urgency')?.value || 'all';

                results.forEach(loc => {
                    if (filterUrgency !== 'all' && loc.urgency !== filterUrgency) return;

                    let iconClass = 'marker-green';
                    if (loc.urgency === 'High') iconClass = 'marker-red';
                    else if (loc.urgency === 'Medium') iconClass = 'marker-yellow';

                    const icon = L.divIcon({ className: `custom-leaflet-dest bounce-icon ${iconClass}`, html: '<i class="fa-solid fa-location-dot"></i>' });
                    
                    const timeAgo = Math.floor((new Date() - new Date(loc.created_at)) / 60000);
                    const expiryMins = Math.max(0, 240 - timeAgo);

                    const popupHTML = `
                        <b>${loc.name}</b><br>
                        <span style="font-size: 0.85rem; color: #666;">📝 ${loc.notes || 'No notes combined'}</span><br>
                        <span style="font-size: 0.85rem;">👥 ${loc.people_count} People | ⚠️ ${loc.urgency} Urgency</span><br>
                        <span style="font-size: 0.8rem; color: #eab308;"><i class="fa-regular fa-clock"></i> Expires in ${expiryMins} mins</span><br>
                        <button class='btn btn-primary mt-2 go-navigate-btn' style='padding: 5px 10px; font-size:0.8rem; width: 100%;' data-lat='${loc.lat}' data-lng='${loc.lng}'><i class="fa-solid fa-location-arrow"></i> Navigate & Deliver</button>
                    `;

                    L.marker([loc.lat, loc.lng], {icon: icon}).bindPopup(popupHTML).addTo(markerClusterGroup);
                });

                // Attach navigation handlers on popup open
                dashboardMap.on('popupopen', function(e) {
                    const btn = document.querySelector('.go-navigate-btn');
                    if (btn) {
                        btn.addEventListener('click', function(ev) {
                            const lat = this.dataset.lat;
                            const lng = this.dataset.lng;
                            window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                        });
                    }
                });
            }).catch(e => console.error("Map Fetch Error:", e));
        };

        window.fetchLocationsAndRenderMap();
        setInterval(window.fetchLocationsAndRenderMap, 30000);

        const filterSelect = document.getElementById('map-filter-urgency');
        if(filterSelect) filterSelect.addEventListener('change', window.fetchLocationsAndRenderMap);

        const radarBtn = document.getElementById('scan-radius-btn');
        let radarActive = false;
        if(radarBtn) {
            radarBtn.addEventListener('click', () => {
                if(radarActive) {
                    if(mapRadiusCircle) dashboardMap.removeLayer(mapRadiusCircle);
                    radarBtn.style.background = 'transparent';
                    radarBtn.style.color = 'var(--primary)';
                    radarActive = false;
                } else {
                    if(navigator.geolocation) {
                        radarBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Locating...';
                        navigator.geolocation.getCurrentPosition(pos => {
                            mapRadiusCircle = L.circle([pos.coords.latitude, pos.coords.longitude], {
                                color: '#10b981',
                                fillColor: '#10b981',
                                fillOpacity: 0.15,
                                radius: 3000 // 3km
                            }).addTo(dashboardMap);
                            dashboardMap.flyTo([pos.coords.latitude, pos.coords.longitude], 13);
                            radarBtn.innerHTML = '<i class="fa-solid fa-radar"></i> Radar Active';
                            radarBtn.style.background = 'rgba(16,185,129,0.1)';
                            radarActive = true;
                        }, err => {
                            radarBtn.innerHTML = '<i class="fa-solid fa-radar"></i> GPS Denied';
                        });
                    }
                }
            });
        }
        
        // Initialize Heatmap layer
        let heatLayer = null;
        if(typeof L.heatLayer !== 'undefined') {
            const heatData = [
                [28.7041, 77.1025, 0.9], // Delhi
                [19.0760, 72.8777, 1.0], // Mumbai core
                [19.1000, 72.9000, 0.8], // Mumbai East
                [19.0500, 72.8500, 0.7], // Mumbai South
                [13.0827, 80.2707, 0.3], // Chennai
                [22.5726, 88.3639, 0.9]  // Kolkata
            ];
            
            // Generate some random points around Mumbai to make it look dense
            for(let i=0; i<40; i++) {
                heatData.push([19.0760 + (Math.random()-0.5)*0.1, 72.8777 + (Math.random()-0.5)*0.1, Math.random()]);
            }
            
            heatLayer = L.heatLayer(heatData, {
                radius: 25, 
                blur: 15, 
                maxZoom: 12,
                gradient: {0.4: 'green', 0.65: 'yellow', 1: 'red'}
            });
        }
        
        const toggleHeatBtn = document.getElementById('toggle-heatmap-btn');
        let heatActive = false;
        if(toggleHeatBtn) {
            toggleHeatBtn.addEventListener('click', () => {
                if(!heatActive) {
                    if(heatLayer) heatLayer.addTo(dashboardMap);
                    toggleHeatBtn.style.background = 'rgba(239,68,68,0.1)';
                    heatActive = true;
                } else {
                    if(heatLayer) dashboardMap.removeLayer(heatLayer);
                    toggleHeatBtn.style.background = 'transparent';
                    heatActive = false;
                }
            });
        }

        // Guarantee map renders correctly regardless of visibility flow
        const resizeObserver = new ResizeObserver(() => {
            dashboardMap.invalidateSize();
        });
        resizeObserver.observe(mapPlaceholder);
    }

    // Toggle self deliver & Nearby Flow
    const selfDeliverCheckbox = document.getElementById('self-deliver-checkbox');
    const postFoodBtnNew = document.getElementById('post-food-btn');
    const selfDeliverBtn = document.getElementById('self-deliver-btn');
    const nearbyContainer = document.getElementById('nearby-locations-container');
    const nearbyList = document.getElementById('nearby-list');

    if (selfDeliverCheckbox) {
        selfDeliverCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                postFoodBtnNew.style.display = 'none';
                selfDeliverBtn.style.display = 'flex';
                if(nearbyContainer) {
                    nearbyContainer.style.display = 'flex';
                    // Populate mock locations within 3km
                    setTimeout(() => {
                        if(nearbyList) {
                            nearbyList.innerHTML = `
                                <div class="nearby-card best-match" data-lat="19.0800" data-lng="72.8800" style="border: 2px solid #fbbf24; background: rgba(251, 191, 36, 0.1);">
                                    <div>
                                        <h5 style="margin-bottom:3px; font-size:1rem;">Dharavi Trust Hub <span class="badge-mini" style="background: #fbbf24; color: #000; font-weight: bold;"><i class="fa-solid fa-star"></i> Smart Match</span></h5>
                                        <p style="font-size:0.8rem; color: #94a3b8;">High Urgency &bull; Needs ~50 meals</p>
                                    </div>
                                    <div class="dist">1.2 km</div>
                                </div>
                                <div class="nearby-card" data-lat="19.0700" data-lng="72.8900">
                                    <div>
                                        <h5 style="margin-bottom:3px; font-size:1rem;">Platform 4 Camp</h5>
                                        <p style="font-size:0.8rem; color: #94a3b8;">Medium Urgency &bull; Needs ~20 meals</p>
                                    </div>
                                    <div class="dist">2.4 km</div>
                                </div>
                            `;
                            // Add selector events
                            document.querySelectorAll('.nearby-card').forEach(card => {
                                card.addEventListener('click', function() {
                                    document.querySelectorAll('.nearby-card').forEach(c => c.classList.remove('selected'));
                                    this.classList.add('selected');
                                    selfDeliverBtn.disabled = false;
                                    selfDeliverBtn.innerHTML = '<i class="fa-solid fa-map-location-dot"></i> Start Delivery Navigation';
                                    selfDeliverBtn.dataset.lat = this.dataset.lat;
                                    selfDeliverBtn.dataset.lng = this.dataset.lng;
                                });
                            });
                        }
                    }, 800);
                }
            } else {
                postFoodBtnNew.style.display = 'flex';
                selfDeliverBtn.style.display = 'none';
                if(nearbyContainer) nearbyContainer.style.display = 'none';
                selfDeliverBtn.disabled = true;
                selfDeliverBtn.innerHTML = '<i class="fa-solid fa-map-location-dot"></i> Select Location First';
            }
        });
    }

    if (selfDeliverBtn) {
        selfDeliverBtn.addEventListener('click', () => {
            // Initiate tracking to the selected needy location
            const lat = selfDeliverBtn.dataset.lat || 19.0800;
            const lng = selfDeliverBtn.dataset.lng || 72.8800;
            openTrackingMap(false, { pickup: [19.0760, 72.8777], dropoff: [parseFloat(lat), parseFloat(lng)] });
            setTimeout(() => {
                startRoutingAnimation([19.0760, 72.8777], [parseFloat(lat), parseFloat(lng)]); 
            }, 500);
        });
    }

    // Post food dynamically creates a task
    if (postFoodBtnNew) {
        postFoodBtnNew.addEventListener('click', () => {
            const desc = document.getElementById('food-desc').value || 'Surplus Food';
            const qty = document.getElementById('food-qty').value || 10;
            const isSelfDeliver = document.getElementById('self-deliver-checkbox')?.checked || false;
            
            postFoodBtnNew.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
            
            const payload = {
                description: desc,
                quantity: qty,
                is_self_delivered: isSelfDeliver,
                status: 'Available',
                prepared_time: new Date().toISOString(),
                expiry_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
            };

            fetch('/api/food/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken') || ''
                },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(data => {
                postFoodBtnNew.innerHTML = '<i class="fa-solid fa-check"></i> Posted Successfully!';
                postFoodBtnNew.style.background = '#10b981';
                
                // Trigger success Toast
                showToast('<i class="fa-solid fa-bullhorn"></i>', 'Food Available Broadcasted', 'Your listing is live. Notifying nearby scouts...');

                // Add to task list dynamically
                const taskList = document.querySelector('.task-list');
                if (taskList) {
                    const newTask = document.createElement('div');
                    newTask.className = 'task-card glass-panel';
                    newTask.innerHTML = `
                        <div class="task-status">Just Posted</div>
                        <h4>${data.description} (approx ${data.quantity} servings)</h4>
                        <p class="location-route"><i class="fa-solid fa-building"></i> Current Location <i class="fa-solid fa-arrow-right mx-2"></i> <i class="fa-solid fa-campground"></i> Nearest Need Point</p>
                        <div class="task-meta">
                            <span><i class="fa-solid fa-route"></i> Just nearby</span>
                            <span><i class="fa-solid fa-medal"></i> +150 Karma</span>
                        </div>
                        <button class="btn btn-primary outline w-100 accept-new-task">Accept Task</button>
                    `;
                    taskList.prepend(newTask);
                    
                    // Bind event listener to newly created Accept Task button
                    const newBtn = newTask.querySelector('.accept-new-task');
                    if(newBtn) {
                        newBtn.addEventListener('click', function() {
                            this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Accepting...';
                            setTimeout(() => {
                                this.innerHTML = '<i class="fa-solid fa-check"></i> Accepted!';
                                this.classList.remove('outline');
                                showToast('<i class="fa-solid fa-motorcycle"></i>', 'Task Accepted', 'Routing started. Please proceed to pickup location.');
                                openTrackingMap('scout-find');
                            }, 1000);
                        });
                    }
                }
                
                setTimeout(() => {
                    postFoodBtnNew.innerHTML = 'Post Food for Rescue <i class="fa-solid fa-arrow-right"></i>';
                    postFoodBtnNew.style.background = '';
                }, 3000);
            }).catch(err => {
                console.error(err);
                postFoodBtnNew.innerHTML = '<i class="fa-solid fa-xmark"></i> Error';
                showToast('<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i>', 'Network Error', 'Failed to communicate with server. Please try again.');
            });
        });
    }

    // Find Pickups - Show nearby location or jump to list
    const findPickupsBtn = document.getElementById('find-pickups-btn');
    if (findPickupsBtn) {
        findPickupsBtn.addEventListener('click', () => {
            openTrackingMap('scout-find');
        });
    }

    // Initialize Time Slides
    function createTimeSlides(containerId) {
        const container = document.getElementById(containerId);
        if(!container) return;
        
        let hourHtml = `<select class="time-slide" title="Hour">`;
        for(let i=1; i<=12; i++) {
            let val = i.toString().padStart(2, '0');
            hourHtml += `<option value="${val}">${val}</option>`;
        }
        hourHtml += `</select>`;
        
        let minHtml = `<select class="time-slide" title="Minute">`;
        for(let i=0; i<60; i+=5) {
            let val = i.toString().padStart(2, '0');
            minHtml += `<option value="${val}">${val}</option>`;
        }
        minHtml += `</select>`;
        
        let ampmHtml = `<select class="time-slide" title="AM/PM"><option>AM</option><option>PM</option></select>`;
        
        container.innerHTML = hourHtml + `<span>:</span>` + minHtml + ampmHtml;
    }
    createTimeSlides('prep-time-container');
    createTimeSlides('consume-time-container');    // Live Tracking & Maps Configs
    const trackOverlay = document.getElementById('live-tracking-overlay');
    const closeTrackBtn = document.getElementById('close-tracking-btn');
    const progressFill = document.getElementById('track-progress-fill');
    const etaTime = document.getElementById('eta-time');
    let trackingMapInstance = null;
    let trackRoutingPoller = null;
    
    // Check if L (Leaflet) is loaded before creating icons
    let customDIcon = null, customNIcon = null;
    if (typeof L !== 'undefined') {
        customDIcon = L.divIcon({ className: 'custom-leaflet-donor', html: '<i class="fa-solid fa-motorcycle"></i>' });
        customNIcon = L.divIcon({ className: 'custom-leaflet-dest bounce-icon', html: '<i class="fa-solid fa-location-dot"></i>' });
    }

    if (closeTrackBtn) {
        closeTrackBtn.addEventListener('click', () => {
            trackOverlay.style.display = 'none';
            if (trackRoutingPoller) clearTimeout(trackRoutingPoller);
        });
    }

    function openTrackingMap(mode, scoutRoute = null) {
        trackOverlay.style.display = 'flex';
        progressFill.style.width = '33%';
        document.querySelectorAll('.progress-steps .step').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.progress-steps .step')[0].classList.add('active');
        
        setTimeout(() => {
            if (!trackingMapInstance) {
                trackingMapInstance = L.map('tracking-map-bg').setView([19.0760, 72.8777], 13);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
                }).addTo(trackingMapInstance);
            }
            trackingMapInstance.invalidateSize();
            
            trackingMapInstance.eachLayer((layer) => {
                if(layer instanceof L.Marker || layer instanceof L.Polyline) { trackingMapInstance.removeLayer(layer); }
            });

            if (mode === true || mode === 'donor') {
                document.getElementById('tracking-status').textContent = 'Select a nearby Needy Location';
                etaTime.textContent = 'Awaiting Selection';
                
                const mockNeedLocations = [
                    { lat: 19.0800, lng: 72.8800, title: "Dharavi Trust - Needs 50 meals" },
                    { lat: 19.0700, lng: 72.8900, title: "Platform 4 - Needs 20 meals" },
                    { lat: 19.0600, lng: 72.8700, title: "NGO Care Center - Needs 10 meals" }
                ];

                mockNeedLocations.forEach(loc => {
                    L.marker([loc.lat, loc.lng], {icon: customNIcon}).addTo(trackingMapInstance)
                        .bindPopup(`<b>${loc.title}</b><br><button class='btn btn-primary mt-2 pick-needy-btn' data-lat='${loc.lat}' data-lng='${loc.lng}' style='padding: 5px 10px; font-size:0.8rem;'>Deliver Here</button>`);
                });

                trackingMapInstance.on('popupopen', () => {
                    const btn = document.querySelector('.pick-needy-btn');
                    if (btn) {
                        btn.onclick = () => {
                            trackingMapInstance.closePopup();
                            startRoutingAnimation([19.0760, 72.8777], [parseFloat(btn.dataset.lat), parseFloat(btn.dataset.lng)]);
                        };
                    }
                });
            } else if (mode === 'scout-find') {
                document.getElementById('tracking-status').textContent = 'Select a nearby Donor to Pickup';
                etaTime.textContent = 'Awaiting Selection';
                
                const mockDonorLocations = [
                    { lat: 19.0600, lng: 72.8500, title: "Grand Hotel - 50 meals" },
                    { lat: 19.0650, lng: 72.8600, title: "Wedding Hall - 100 meals" }
                ];

                mockDonorLocations.forEach(loc => {
                    L.marker([loc.lat, loc.lng], {icon: customDIcon}).addTo(trackingMapInstance)
                        .bindPopup(`<b>${loc.title}</b><br><button class='btn btn-primary mt-2 accept-donor-btn' data-lat='${loc.lat}' data-lng='${loc.lng}' style='padding: 5px 10px; font-size:0.8rem;'>Accept Pickup</button>`);
                });

                trackingMapInstance.on('popupopen', () => {
                    const btn = document.querySelector('.accept-donor-btn');
                    if (btn) {
                        btn.onclick = () => {
                            trackingMapInstance.closePopup();
                            document.getElementById('tracking-status').textContent = 'Routing to Donor Pickup...';
                            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Accepting...';
                            setTimeout(() => {
                                showToast('<i class="fa-solid fa-motorcycle"></i>', 'Task Accepted', 'Routing path calculated. Connect with donor.');
                                startRoutingAnimation([19.0760, 72.8777], [parseFloat(btn.dataset.lat), parseFloat(btn.dataset.lng)]);
                            }, 800);
                        };
                    }
                });
            } else if (scoutRoute) {
                const donorPinIcon = L.divIcon({ className: 'custom-leaflet-dest marker-donor-pin', html: '<i class="fa-solid fa-store"></i>' });
                // Pin the donor's exact pickup location
                L.marker(scoutRoute.pickup, {icon: donorPinIcon}).addTo(trackingMapInstance).bindPopup("<b>Pickup Point</b><br>Donor Location").openPopup();
                // Pin the delivery dropoff location
                L.marker(scoutRoute.dropoff, {icon: customNIcon}).addTo(trackingMapInstance).bindPopup("<b>Dropoff Point</b><br>Needy Location");
                // Zoom map to fit both
                trackingMapInstance.fitBounds([scoutRoute.pickup, scoutRoute.dropoff], { padding: [50, 50] });
            }
        }, 300);
    }

    function startRoutingAnimation(startCoords, endCoords) {
        document.getElementById('tracking-status').textContent = 'Routing to Delivery...';
        etaTime.textContent = '15 mins ETA';
        document.querySelectorAll('.progress-steps .step')[1].classList.add('active');
        
        L.polyline([startCoords, endCoords], {color: '#10b981', weight: 4, dashArray: '10, 10'}).addTo(trackingMapInstance);
        const movingMarker = L.marker(startCoords, {icon: customDIcon}).addTo(trackingMapInstance);
        
        let steps = 40, step = 0;
        const latInc = (endCoords[0] - startCoords[0]) / steps;
        const lngInc = (endCoords[1] - startCoords[1]) / steps;

        function animate() {
            step++;
            movingMarker.setLatLng([startCoords[0] + (latInc * step), startCoords[1] + (lngInc * step)]);
            
            etaTime.textContent = Math.max(0, 15 - Math.floor(15 * (step / steps))) + ' mins';
            progressFill.style.width = (33 + (66 * (step/steps))) + '%';
            
            if (step < steps) {
                trackRoutingPoller = setTimeout(animate, 200);
            } else {
                document.getElementById('tracking-status').textContent = 'Food Delivered Successfully!';
                etaTime.textContent = 'Delivered!';
                document.querySelectorAll('.progress-steps .step')[2].classList.add('active');
            }
        }
        animate();
    }

    // Click handler for selfDeliverBtn is now managed alongside the Nearby flow logic.

    // Trigger Tracking via Accept Task for Scout
    document.addEventListener('click', (e) => {
        if (e.target.closest('.task-card .btn.accept-new-task') || e.target.closest('.task-card .btn')) {
            const button = e.target.closest('.task-card .btn');
            if(button.disabled) return; // Prevent double clicks
            
            button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading Map...';
            setTimeout(() => {
                button.innerHTML = '<i class="fa-solid fa-check"></i> Accepted';
                button.classList.remove('outline');
                button.classList.add('btn-primary');
                button.disabled = true;
                
                const card = button.closest('.task-card');
                card.style.opacity = '0.7';
                card.style.borderLeftColor = '#94a3b8';
                
                // Open Map for Scout passing donor & needy coordinates
                const pickupCoords = [19.0600, 72.8500];
                const dropoffCoords = [19.0900, 72.8900];
                
                openTrackingMap(false, { pickup: pickupCoords, dropoff: dropoffCoords });
                
                // Start animation slightly after map opens
                setTimeout(() => {
                    startRoutingAnimation(pickupCoords, dropoffCoords); 
                }, 500);
            }, 800);
        }
    });

    // =================== SCOUT MODULE ===================
    // Scout Map Instance
    let scoutMap = null;
    let scoutMarkers = [];

    function initScoutMap() {
        if (scoutMap) return;
        const mapEl = document.getElementById('scout-map');
        if (!mapEl) return;
        
        scoutMap = L.map('scout-map', {
            center: [20.5937, 78.9629],
            zoom: 5,
            maxBounds: [[6.5, 68.0], [37.0, 97.5]],
            minZoom: 4
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(scoutMap);

        // Load markers from API
        fetchScoutMapLocations();
    }

    function getUrgencyColor(urgency) {
        return urgency === 'High' ? '#ef4444' : urgency === 'Medium' ? '#eab308' : '#22c55e';
    }

    function getCategoryIcon(cat) {
        const icons = { 'Children': '👶', 'Elderly': '👴', 'Mixed': '👨‍👩‍👧‍👦', 'General': '🧑' };
        return icons[cat] || '🧑';
    }

    function getFoodIcon(ft) {
        const icons = { 'Veg': '🥬', 'Non-veg': '🍗', 'Any': '🍽️' };
        return icons[ft] || '🍽️';
    }

    function fetchScoutMapLocations() {
        fetch('/api/locations/').then(r => r.json()).then(locations => {
            // Clear old markers
            scoutMarkers.forEach(m => scoutMap.removeLayer(m));
            scoutMarkers = [];

            locations.forEach(loc => {
                const color = getUrgencyColor(loc.urgency);
                const marker = L.circleMarker([loc.lat, loc.lng], {
                    radius: 10,
                    fillColor: color,
                    color: color,
                    weight: 2,
                    opacity: 0.9,
                    fillOpacity: 0.6
                }).addTo(scoutMap);

                const statusClass = (loc.status || 'Pending').toLowerCase().replace(' ', '-');

                marker.bindPopup(`
                    <div style="min-width: 200px; font-family: Outfit, sans-serif;">
                        <h4 style="margin: 0 0 5px; font-size: 1rem;">${loc.name}</h4>
                        <span class="scout-req-status ${statusClass}" style="display:inline-block; margin-bottom: 8px;">${loc.status}</span>
                        <div style="font-size: 0.85rem; color: #666; line-height: 1.6;">
                            <div>👥 <strong>${loc.people_count}</strong> people</div>
                            <div>⚠️ ${loc.urgency} urgency</div>
                            <div>${getCategoryIcon(loc.category)} ${loc.category || 'General'}</div>
                            <div>${getFoodIcon(loc.food_type)} ${loc.food_type || 'Any'}</div>
                            ${loc.address ? `<div>📍 ${loc.address}</div>` : ''}
                            ${loc.notes ? `<div style="font-style:italic; margin-top:4px;">📝 ${loc.notes}</div>` : ''}
                            <div>⏰ ${loc.time_remaining || 0} mins remaining</div>
                        </div>
                    </div>
                `);
                scoutMarkers.push(marker);
            });

            // Render active requests list
            renderActiveRequests(locations);
        }).catch(() => {});
    }

    // Reverse Geocoding via Nominatim
    function reverseGeocode(lat, lng, callback) {
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`)
            .then(r => r.json())
            .then(data => {
                const address = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                callback(address);
            })
            .catch(() => callback(`${lat.toFixed(4)}, ${lng.toFixed(4)}`));
    }

    // Scout Mini Map
    let scoutMiniMap = null;
    let scoutMiniMarker = null;

    function initScoutMiniMap(lat, lng) {
        const container = document.getElementById('scout-mini-map');
        if (!container) return;

        if (scoutMiniMap) {
            scoutMiniMap.remove();
            scoutMiniMap = null;
        }

        scoutMiniMap = L.map('scout-mini-map', {
            center: [lat, lng],
            zoom: 16,
            zoomControl: false,
            attributionControl: false
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(scoutMiniMap);
        
        scoutMiniMarker = L.marker([lat, lng], { draggable: true }).addTo(scoutMiniMap);
        
        // Allow dragging pin to adjust location
        scoutMiniMarker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            document.getElementById('scout-loc-lat').value = pos.lat;
            document.getElementById('scout-loc-lng').value = pos.lng;
            reverseGeocode(pos.lat, pos.lng, addr => {
                document.getElementById('scout-loc-address').value = addr;
            });
        });
    }

    // Photo Upload Preview
    const photoDropArea = document.getElementById('scout-photo-drop');
    const photoInput = document.getElementById('scout-loc-photo');
    const photoPreview = document.getElementById('scout-photo-preview');

    if (photoDropArea && photoInput) {
        photoDropArea.addEventListener('click', () => photoInput.click());
        
        photoInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    photoPreview.innerHTML = `<img src="${ev.target.result}" style="max-width: 100%; max-height: 150px; border-radius: 8px;">
                        <p style="color: var(--primary); font-size: 0.8rem; margin-top: 5px;"><i class="fa-solid fa-check"></i> Photo attached</p>`;
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });

        // Drag & drop support
        photoDropArea.addEventListener('dragover', (e) => { e.preventDefault(); photoDropArea.style.borderColor = 'var(--secondary)'; });
        photoDropArea.addEventListener('dragleave', () => { photoDropArea.style.borderColor = 'var(--panel-border)'; });
        photoDropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            photoDropArea.style.borderColor = 'var(--panel-border)';
            if (e.dataTransfer.files[0]) {
                photoInput.files = e.dataTransfer.files;
                photoInput.dispatchEvent(new Event('change'));
            }
        });
    }

    // Scout Needy Location Modal API Logic
    const dropPinBtn = document.getElementById('drop-pin-btn');
    const scoutModal = document.getElementById('scout-mark-modal');
    const closeScoutModal = document.getElementById('close-scout-modal');
    const submitScoutBtn = document.getElementById('submit-scout-loc-btn');
    const gpsStatusBox = document.getElementById('scout-gps-status');
    const latInput = document.getElementById('scout-loc-lat');
    const lngInput = document.getElementById('scout-loc-lng');

    if(dropPinBtn) {
        dropPinBtn.addEventListener('click', () => {
            scoutModal.style.display = 'flex';
            submitScoutBtn.disabled = true;
            gpsStatusBox.innerHTML = '<i class="fa-solid fa-satellite-dish fa-fade"></i> Acquiring Live GPS Coordinate...';
            gpsStatusBox.style.color = 'var(--primary)';
            gpsStatusBox.style.borderColor = 'var(--primary)';
            document.getElementById('scout-loc-address').value = 'Auto-detecting from GPS...';
            
            // Reset photo
            if (photoPreview) {
                photoPreview.innerHTML = `<i class="fa-solid fa-cloud-arrow-up" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 8px;"></i>
                    <p style="color: var(--text-muted); font-size: 0.85rem;">Click to upload or drag & drop photo</p>`;
            }
            
            if(navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(pos => {
                    latInput.value = pos.coords.latitude;
                    lngInput.value = pos.coords.longitude;
                    gpsStatusBox.innerHTML = `<i class="fa-solid fa-check"></i> GPS Locked: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
                    submitScoutBtn.disabled = false;
                    
                    // Reverse geocode
                    reverseGeocode(pos.coords.latitude, pos.coords.longitude, addr => {
                        document.getElementById('scout-loc-address').value = addr;
                        document.getElementById('scout-loc-address').style.fontStyle = 'normal';
                        document.getElementById('scout-loc-address').style.color = 'var(--text-main)';
                    });
                    
                    // Init mini map
                    setTimeout(() => initScoutMiniMap(pos.coords.latitude, pos.coords.longitude), 100);
                    
                }, err => {
                    // Fallback: Use a default India coordinate
                    const fallbackLat = 19.0760;
                    const fallbackLng = 72.8777;
                    latInput.value = fallbackLat;
                    lngInput.value = fallbackLng;
                    gpsStatusBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> GPS unavailable. Using default location (Mumbai). Drag pin to adjust.';
                    gpsStatusBox.style.color = '#eab308';
                    gpsStatusBox.style.borderColor = '#eab308';
                    submitScoutBtn.disabled = false;
                    
                    reverseGeocode(fallbackLat, fallbackLng, addr => {
                        document.getElementById('scout-loc-address').value = addr;
                    });
                    setTimeout(() => initScoutMiniMap(fallbackLat, fallbackLng), 100);
                });
            } else {
                gpsStatusBox.innerHTML = "GPS Not Supported by this browser.";
            }
        });
    }

    if(closeScoutModal) {
        closeScoutModal.addEventListener('click', () => scoutModal.style.display = 'none');
    }

    if(submitScoutBtn) {
        submitScoutBtn.addEventListener('click', () => {
            const name = document.getElementById('scout-loc-name').value;
            const headcount = document.getElementById('scout-loc-people').value;
            const urgency = document.getElementById('scout-loc-urgency').value;
            const category = document.getElementById('scout-loc-category').value;
            const foodType = document.getElementById('scout-loc-foodtype').value;
            const notes = document.getElementById('scout-loc-notes').value;
            const address = document.getElementById('scout-loc-address').value;
            
            if(!name || !headcount) return alert("Please fill Title and Headcount.");
            
            submitScoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
            
            fetch('/api/locations/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') || '' },
                body: JSON.stringify({
                    name: name,
                    people_count: parseInt(headcount),
                    urgency: urgency,
                    category: category,
                    food_type: foodType,
                    notes: notes,
                    address: address,
                    lat: parseFloat(latInput.value),
                    lng: parseFloat(lngInput.value),
                    status: 'Pending',
                    is_active: true
                })
            }).then(async r => {
                if(r.status === 409) {
                    const errObj = await r.json();
                    throw new Error(errObj.detail || "Location exists.");
                }
                if(!r.ok) throw new Error("Upload Failed");
                return r.json();
            }).then(data => {
                scoutModal.style.display = 'none';
                submitScoutBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Upload to Network';
                showToast('<i class="fa-solid fa-map-pin"></i>', 'Location Reported', 'Nearby donors map has been updated successfully!');
                
                // Refresh maps
                if(typeof window.fetchLocationsAndRenderMap === 'function') window.fetchLocationsAndRenderMap();
                if(scoutMap) fetchScoutMapLocations();
                fetchScoutStats();
                
            }).catch(e => {
                submitScoutBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Upload to Network';
                if(e.message.indexOf("200m") !== -1 || e.message.indexOf("exist") !== -1) {
                    showToast('<i class="fa-solid fa-copy" style="color:#ef4444;"></i>', 'Duplicate Detected', 'A need is already marked within 200m. Please update instead.');
                } else {
                    showToast('<i class="fa-solid fa-xmark" style="color:#ef4444;"></i>', 'Failed', 'Upload rejected by server.');
                }
            });
        });
    }

    // Render Active Requests
    function renderActiveRequests(locations) {
        const container = document.getElementById('active-requests-list');
        if (!container || !locations || locations.length === 0) return;
        
        container.innerHTML = locations.map(loc => {
            const statusClass = (loc.status || 'Pending').toLowerCase().replace(' ', '-');
            const urgencyColor = loc.urgency === 'High' ? '#ef4444' : loc.urgency === 'Medium' ? '#eab308' : '#22c55e';
            const isInTransit = loc.status === 'In Transit';
            
            return `
            <div class="scout-request-card glass-panel" data-id="${loc.id}">
                <div class="scout-req-header">
                    <div class="scout-req-status ${statusClass}">${loc.status}</div>
                    <span class="scout-req-time"><i class="fa-regular fa-clock"></i> ${loc.time_remaining || 0} mins left</span>
                </div>
                <h4>${loc.name}</h4>
                <div class="scout-req-meta">
                    <span><i class="fa-solid fa-users"></i> ${loc.people_count} people</span>
                    <span><i class="fa-solid fa-triangle-exclamation" style="color:${urgencyColor};"></i> ${loc.urgency}</span>
                    <span>${getCategoryIcon(loc.category)} ${loc.category || 'General'}</span>
                    <span>${getFoodIcon(loc.food_type)} ${loc.food_type || 'Any'}</span>
                </div>
                ${loc.notes ? `<p class="scout-req-notes">${loc.notes}</p>` : ''}
                ${loc.address ? `<p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;"><i class="fa-solid fa-location-dot"></i> ${loc.address}</p>` : ''}
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                    ${isInTransit 
                        ? `<button class="btn btn-primary scout-proof-btn" data-id="${loc.id}" style="flex:1; padding: 8px; font-size: 0.8rem; justify-content: center;"><i class="fa-solid fa-camera"></i> Upload Proof</button>`
                        : `<button class="btn btn-primary scout-deliver-btn" data-id="${loc.id}" style="flex:1; padding: 8px; font-size: 0.8rem; justify-content: center;"><i class="fa-solid fa-motorcycle"></i> Deliver Here</button>`
                    }
                    <button class="btn btn-outline scout-extend-btn" data-id="${loc.id}" style="padding: 8px; font-size: 0.8rem; border-color: var(--primary); color: var(--primary);"><i class="fa-solid fa-clock-rotate-left"></i> Extend</button>
                    <button class="btn btn-outline scout-bookmark-btn" data-lat="${loc.lat}" data-lng="${loc.lng}" data-name="${loc.name}" data-addr="${loc.address || ''}" style="padding: 8px; font-size: 0.8rem; border-color: var(--accent); color: var(--accent);"><i class="fa-solid fa-bookmark"></i></button>
                </div>
            </div>`;
        }).join('');

        // Attach event listeners
        container.querySelectorAll('.scout-extend-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                fetch(`/api/locations/${id}/refresh/`, {
                    method: 'POST',
                    headers: { 'X-CSRFToken': getCookie('csrftoken') || '' }
                }).then(r => r.json()).then(() => {
                    showToast('<i class="fa-solid fa-clock-rotate-left"></i>', 'Extended', 'Request extended by 2 hours.');
                    fetchScoutMapLocations();
                }).catch(() => showToast('<i class="fa-solid fa-xmark" style="color:#ef4444;"></i>', 'Failed', 'Could not extend request.'));
            });
        });

        container.querySelectorAll('.scout-deliver-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                fetch(`/api/locations/${id}/accept/`, {
                    method: 'POST',
                    headers: { 'X-CSRFToken': getCookie('csrftoken') || '' }
                }).then(r => r.json()).then(() => {
                    showToast('<i class="fa-solid fa-truck-fast" style="color:var(--primary);"></i>', 'Accepted', 'You are now delivering to this location!');
                    fetchScoutMapLocations();
                }).catch(() => showToast('<i class="fa-solid fa-xmark" style="color:#ef4444;"></i>', 'Failed', 'Could not accept delivery.'));
            });
        });

        container.querySelectorAll('.scout-bookmark-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const bookmark = {
                    name: btn.dataset.name,
                    lat: btn.dataset.lat,
                    lng: btn.dataset.lng,
                    address: btn.dataset.addr,
                    saved_at: new Date().toISOString()
                };
                let bookmarks = JSON.parse(localStorage.getItem('scout_bookmarks') || '[]');
                const exists = bookmarks.some(b => Math.abs(b.lat - bookmark.lat) < 0.001 && Math.abs(b.lng - bookmark.lng) < 0.001);
                if (!exists) {
                    bookmarks.push(bookmark);
                    localStorage.setItem('scout_bookmarks', JSON.stringify(bookmarks));
                    showToast('<i class="fa-solid fa-bookmark" style="color:var(--accent);"></i>', 'Bookmarked', `"${bookmark.name}" saved to bookmarks.`);
                } else {
                    showToast('<i class="fa-solid fa-bookmark" style="color:#eab308;"></i>', 'Already Saved', 'This location is already bookmarked.');
                }
            });
        });

        container.querySelectorAll('.scout-proof-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                showToast('<i class="fa-solid fa-camera" style="color:var(--primary);"></i>', 'Proof Upload', 'Photo proof feature — take a photo of the delivered food.');
            });
        });
    }

    // Fetch Scout Stats
    function fetchScoutStats() {
        fetch('/api/scout-stats/').then(r => r.json()).then(data => {
            const el = id => document.getElementById(id);
            if (el('scout-stat-marked')) el('scout-stat-marked').textContent = data.total_marked;
            if (el('scout-stat-delivered')) el('scout-stat-delivered').textContent = data.completed_deliveries;
            if (el('scout-stat-karma')) el('scout-stat-karma').textContent = data.karma_points.toLocaleString();
            if (el('scout-stat-rank')) el('scout-stat-rank').textContent = data.rank;
            
            // Update badges
            const badgesEl = document.getElementById('scout-badges');
            if (badgesEl && data.badges) {
                const badgeLabel = '<span style="color: var(--text-muted); font-weight: 600; font-size: 0.85rem;"><i class="fa-solid fa-certificate"></i> Badges:</span>';
                const badgeHtml = data.badges.map(b => `<span class="badge-mini sustainability">${b}</span>`).join('');
                badgesEl.innerHTML = badgeLabel + badgeHtml;
            }
        }).catch(() => {});
    }

    // Bookmarks Panel
    const openBookmarksBtn = document.getElementById('open-bookmarks-btn');
    if (openBookmarksBtn) {
        openBookmarksBtn.addEventListener('click', () => {
            const bookmarks = JSON.parse(localStorage.getItem('scout_bookmarks') || '[]');
            if (bookmarks.length === 0) {
                showToast('<i class="fa-solid fa-bookmark"></i>', 'No Bookmarks', 'You have not bookmarked any locations yet.');
                return;
            }
            let msg = bookmarks.map((b, i) => `${i + 1}. ${b.name} (${b.address || 'No address'})`).join('\n');
            showToast('<i class="fa-solid fa-bookmark" style="color:var(--accent);"></i>', `${bookmarks.length} Bookmarks`, bookmarks[0].name + (bookmarks.length > 1 ? ` and ${bookmarks.length - 1} more` : ''));
        });
    }

    // Refresh button
    const refreshReqBtn = document.getElementById('refresh-requests-btn');
    if (refreshReqBtn) {
        refreshReqBtn.addEventListener('click', () => {
            refreshReqBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
            fetchScoutMapLocations();
            setTimeout(() => {
                refreshReqBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Refresh';
                showToast('<i class="fa-solid fa-check" style="color:var(--primary);"></i>', 'Updated', 'Requests list refreshed.');
            }, 800);
        });
    }

    // Initialize Scout section when navigated to
    const scoutNavItem = document.querySelector('[data-target="volunteer"]');
    if (scoutNavItem) {
        scoutNavItem.addEventListener('click', () => {
            setTimeout(() => {
                initScoutMap();
                fetchScoutStats();
            }, 200);
        });
    }

    // Status polling every 30 seconds
    setInterval(() => {
        if (document.getElementById('volunteer') && document.getElementById('volunteer').classList.contains('active')) {
            fetchScoutMapLocations();
        }
    }, 30000);


    // Landing Page & Auth Logic
    const btnNavLogin = document.getElementById('btn-nav-login');
    const btnNavSignup = document.getElementById('btn-nav-signup');
    const btnHeroDonate = document.getElementById('btn-hero-donate');
    const btnHeroVolunteer = document.getElementById('btn-hero-volunteer');
    const btnFooterJoin = document.getElementById('btn-footer-join');
    const btnCancelAuth = document.getElementById('btn-cancel-auth');

    const landingContent = document.getElementById('landing-content');
    const authContainer = document.getElementById('auth-container');
    const authFormPanel = document.getElementById('auth-form-panel');
    const authTitle = document.getElementById('auth-title');
    const authSwitchText = document.getElementById('auth-switch-text');
    const authSwitchLink = document.getElementById('auth-switch-link');
    const nameGroup = document.getElementById('name-group');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const roleSelector = document.getElementById('role-selector');
    const authForm = document.getElementById('auth-form');
    
    const landingPage = document.getElementById('landing-page');
    const appDashboard = document.getElementById('app-dashboard');
    
    let isLoginMode = false;

    function setAuthMode(login) {
        isLoginMode = login;
        if(landingContent) landingContent.style.display = 'none';
        if(authContainer) authContainer.style.display = 'flex';
        authFormPanel.style.display = 'block';
        
        if (isLoginMode) {
            authTitle.textContent = 'Log In';
            if (nameGroup) nameGroup.style.display = 'none';
            const locGrp = document.getElementById('location-group');
            if (locGrp) locGrp.style.display = 'none';
            roleSelector.style.display = 'none';
            authSubmitBtn.textContent = 'Sign In';
            
            // Disable required fields for hidden inputs so HTML5 validation doesn't block submit
            const nameInput = document.getElementById('auth-name');
            const locInput = document.getElementById('auth-location');
            if(nameInput) nameInput.required = false;
            if(locInput) locInput.required = false;
            
            authSwitchText.innerHTML = `Don't have an account?`;
            const switchLink = document.getElementById('auth-switch-link') ||
                document.querySelector('.auth-switch').appendChild(Object.assign(document.createElement('span'), {id: 'auth-switch-link', style: 'color: var(--primary); font-weight: 600; cursor: pointer;', textContent: 'Sign Up', onclick: () => setAuthMode(false)}));
            switchLink.textContent = ' Sign Up';
            switchLink.onclick = () => setAuthMode(!isLoginMode);
        } else {
            authTitle.textContent = 'Sign Up';
            if (nameGroup) nameGroup.style.display = 'flex';
            const locGrp = document.getElementById('location-group');
            if (locGrp) locGrp.style.display = 'block';
            roleSelector.style.display = 'flex';
            authSubmitBtn.textContent = 'Create Account';
            
            // Re-enable required fields
            const nameInput = document.getElementById('auth-name');
            const locInput = document.getElementById('auth-location');
            if(nameInput) nameInput.required = true;
            if(locInput) locInput.required = true;
            
            authSwitchText.innerHTML = `Already have an account?`;
            const switchLink = document.getElementById('auth-switch-link') || 
                document.querySelector('.auth-switch').appendChild(Object.assign(document.createElement('span'), {id: 'auth-switch-link', style: 'color: var(--primary); font-weight: 600; cursor: pointer;', textContent: 'Log In', onclick: () => setAuthMode(true)}));
            switchLink.textContent = ' Log In';
            switchLink.onclick = () => setAuthMode(!isLoginMode);
        }
    }

    const authTriggerBtns = [btnNavSignup, btnHeroDonate, btnHeroVolunteer, btnFooterJoin];
    authTriggerBtns.forEach(btn => {
        if (btn) btn.addEventListener('click', () => setAuthMode(false));
    });

    if (btnNavLogin) {
        btnNavLogin.addEventListener('click', () => setAuthMode(true));
    }

    if (btnCancelAuth) {
        btnCancelAuth.addEventListener('click', () => {
            if(authContainer) authContainer.style.display = 'none';
            if(landingContent) landingContent.style.display = 'block';
        });
    }

    if (authSwitchLink) {
        authSwitchLink.addEventListener('click', () => {
            setAuthMode(!isLoginMode);
        });
    }

    // Geolocation for Signup API Call
    const getLocationBtn = document.getElementById('get-location-btn');
    const authLocationInput = document.getElementById('auth-location');
    if (getLocationBtn && authLocationInput) {
        getLocationBtn.addEventListener('click', () => {
            getLocationBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        // Use coords to mock reverse geocoding
                        setTimeout(() => {
                            authLocationInput.value = `Lat: ${position.coords.latitude.toFixed(4)}, Lng: ${position.coords.longitude.toFixed(4)} (GPS Locked)`;
                            getLocationBtn.innerHTML = '<i class="fa-solid fa-check" style="color:#10b981;"></i>';
                        }, 800);
                    },
                    (error) => {
                        alert("Geolocation access denied. Please allow map tracking.");
                        getLocationBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
                    }
                );
            } else {
                alert("Geolocation not supported by this browser.");
                getLocationBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
            }
        });
    }

    // Role selection functionality
    const roleBtns = document.querySelectorAll('.role-btn');
    roleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            roleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    if (authForm) {
        authForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Simulate Authentication
            authSubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
            
            setTimeout(() => {
                // Hide landing page, show app dashboard
                landingPage.style.display = 'none';
                appDashboard.style.display = 'flex';
                
                // Update user profile name if signup
                if (!isLoginMode) {
                    const nameInput = document.getElementById('auth-name').value;
                    if (nameInput) {
                        const userNameDisplay = document.querySelector('.user-info h4');
                        if (userNameDisplay) userNameDisplay.textContent = nameInput;
                    }
                }
            }, 1000);
        });
    }

    // Leaderboard Tabs Toggle
    const tabBtns = document.querySelectorAll('.leaderboard-tabs .tab-btn');
    const boards = document.querySelectorAll('.leaderboard-board');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            boards.forEach(bd => bd.style.display = 'none');
            const targetId = btn.getAttribute('data-target');
            if(document.getElementById(targetId)) {
                document.getElementById(targetId).style.display = 'block';
            }
        });
    });
});
