import api from './routeSidebarApi.js';
import validator from './routeSidebarValidator.js';
import Modal from '../../../../helpers/ModalManager.js';
import Banner from '../../../../helpers/SelectionBanner.js';
import { showApiErrors } from '../../../../helpers/showApiErrors.js';

$(function () {
    'use strict';

    let debounceTimer = null;
    let savedRouteState = null;

    if (validator && typeof validator.initRouteCustomRules === "function") {
        validator.initRouteCustomRules();
    }

    const getMap = () => window.TransitMapInstance;

    $(document).on('click', '.btn-delete-route', function (e) {
        e.stopPropagation();
        const $routeItem = $(this).closest('.route-item');
        const routeId = $routeItem.data('id');
        if (!confirm('Видалити маршрут?')) return;

        api.deleteRoute(routeId)
            .done(() => {
                const map = getMap();
                if (map && typeof map.deleteRoute === 'function') {
                    map.deleteRoute(routeId);
                }
                $routeItem.remove();
            })
            .fail((xhr) => {
                if (xhr.status === 401) {
                    window.location.href = '/login';
                    return;
                }
                if (xhr.status === 403) {
                    alert('Немає прав для видалення цього маршрута');
                    return;
                }
                alert('Помилка видалення маршрута');
            });
    });

    $(document).on('click', '.route-item', function (e) {
        if ($(this).hasClass('is-editing') || $(e.target).closest('.route-actions').length) {
            return;
        }
        const map = getMap();
        const routeId = $(this).data('id');
        if (map && routeId !== undefined) {
            map.focusOnRoute(Number(routeId));
        }
    });

    $(document).on('click', '#open-route-modal-btn', function () {
        openAddRouteModal();
    });

    function openAddRouteModal() {
        if (!Modal) {
            console.error('Global Modal manager library instance not found.');
            return;
        }

        Modal.open('Новий маршрут', '#tpl-add-route', {
            ...validator.routeFormRules,
            showErrors: function (errorMap, errorList) {
                this.defaultShowErrors();

                const $form = $(this.currentForm);
                const $submitBtn = $form.find('#btn-submit-route');

                if (this.numberOfInvalids() > 0) {
                    $submitBtn.prop('disabled', true);
                } else {
                    $submitBtn.prop('disabled', false);
                }
            },
            submitHandler: (form) => {
                const $form = $(form);

                const stopIds = [];
                $form.find('#selected-stops-list .selected-stop-item').each(function () {
                    stopIds.push($(this).data('stop-id'));
                });

                const routeData = {
                    number: $form.find('#route-number').val().trim(),
                    type: $form.find('#route-type').val(),
                    name: $form.find('#route-name').val().trim(),
                    color: $form.find('#selected-route-color').val(),
                    selectedStops: stopIds
                };

                const $submitBtn = $form.find('#btn-submit-route');
                $submitBtn.prop('disabled', true).addClass('loading');

                api.createRoute(routeData)
                    .done(async (html) => {
                        savedRouteState = null;

                        const $newItem = $(html);
                        $('.route-list').append($newItem);

                        const newRouteId = Number($newItem.data('id'));
                        const newRouteColor = $newItem.attr('data-color');
                        const newRouteStops = $newItem.data('stops');

                        const map = getMap();

                        if (map && typeof map.addRoute === 'function' && Array.isArray(newRouteStops) && newRouteStops.length >= 2) {
                            await map.addRoute(newRouteId, newRouteStops, newRouteColor, {
                                number: $newItem.find('.route-number').text().replace('№', '').trim(),
                                name: $newItem.find('.route-name').text().trim()
                            });
                        }

                        Modal.close();

                        map.focusOnRoute(newRouteId);
                    })
                    .fail((xhr) => {
                        if (xhr.status === 401) {
                            window.location.href = '/login';
                            return;
                        }
                        if (xhr.status === 400 && xhr.responseJSON?.errors) {
                            showApiErrors($form, xhr.responseJSON.errors);
                            return;
                        }
                        alert('Помилка збереження маршруту');
                    })
                    .always(() => {
                        $submitBtn.prop('disabled', false).removeClass('loading');
                    });
            }
        });

        const $modalBody = $('#modal-body-content');
        const $form = $modalBody.find('form');
        const $submitBtn = $modalBody.find('#btn-submit-route');
        const $selectedList = $modalBody.find('#selected-stops-list');
        const $bucket = $modalBody.find('#available-stops-bucket');
        const $stopsTrigger = $modalBody.find('input[name="selectedStops"]');

        if (savedRouteState) {
            $modalBody.find('#route-number').val(savedRouteState.number);
            $modalBody.find('#route-type').val(savedRouteState.type);
            $modalBody.find('#route-name').val(savedRouteState.name);
            $modalBody.find('#selected-route-color').val(savedRouteState.color);
            $modalBody.find(`.color-dot[data-color="${savedRouteState.color}"]`).addClass('active').siblings().removeClass('active');

            if (savedRouteState.stopIds && savedRouteState.stopIds.length > 0) {
                savedRouteState.stopIds.forEach(id => {
                    const $bucketItem = $bucket.find(`.bucket-item-btn[data-stop-id="${id}"]`);
                    if ($bucketItem.length) {
                        addStopToSelected($bucketItem);
                    }
                });
            }
        } else {
            $modalBody.find('.color-dot').first().addClass('active');
        }

        $modalBody.on('click', '.color-dot', function () {
            const color = $(this).data('color');
            $modalBody.find('#selected-route-color').val(color).valid();
            $(this).addClass('active').siblings().removeClass('active');
        });

        function addStopToSelected($btn) {
            const stopId = $btn.data('stop-id');
            const stopName = $btn.text().trim();

            const $selectedItem = $(`
                <li class="selected-stop-item" data-stop-id="${stopId}" style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-2); background: var(--color-bg-subtle, #f8fafc); border: 1px solid var(--color-border); border-radius: var(--radius-sm); margin-bottom: 4px;">
                    <span class="stop-order-index" style="font-weight: 600; font-size: 0.8rem; margin-right: 8px; color: var(--color-muted);"></span>
                    <span class="stop-title-text" style="flex-grow: 1; font-size: 0.85rem;">${stopName}</span>
                    <button type="button" class="btn-remove-selected-stop" style="background: transparent; border: none; color: #ef4444; cursor: pointer; font-size: 1rem; padding: 0 var(--space-2);">✕</button>
                </li>
            `);

            $selectedList.append($selectedItem);

            updateOrderIndexes();
            triggerStopsValidation();
        }

        $modalBody.on('click', '.bucket-item-btn', function () {
            addStopToSelected($(this));
        });

        $modalBody.on('click', '.btn-remove-selected-stop', function () {
            const $item = $(this).closest('.selected-stop-item');
            const stopId = $item.data('stop-id');
            $bucket.find(`.bucket-item-btn[data-stop-id="${stopId}"]`).parent('.bucket-item').removeClass('hidden');
            $item.remove();
            updateOrderIndexes();
            triggerStopsValidation();
        });

        function updateOrderIndexes() {
            $selectedList.find('.selected-stop-item').each(function (index) {
                $(this).find('.stop-order-index').text(`${index + 1}.`);
            });
            const totalVisibleInBucket = $bucket.find('#bucket-item:not(.hidden)').length;
            if (totalVisibleInBucket === 0) {
                $modalBody.find('#bucket-empty-msg').removeClass('hidden');
            } else {
                $modalBody.find('#bucket-empty-msg').addClass('hidden');
            }
        }

        function triggerStopsValidation() {
            if ($stopsTrigger.length) {
                const count = $selectedList.find('.selected-stop-item').length;
                $stopsTrigger.val(count >= 2 ? "valid" : "").valid();
            }
        }

        $modalBody.on('click', '#js-close-route-modal', function (e) {
            e.preventDefault();
            Modal.close();
        });

        $modalBody.on('click', '#btn-route-pick-map', function () {
            const stopIds = [];
            $selectedList.find('.selected-stop-item').each(function () {
                stopIds.push(Number($(this).data('stop-id')));
            });

            savedRouteState = {
                number: $modalBody.find('#route-number').val(),
                type: $modalBody.find('#route-type').val(),
                name: $modalBody.find('#route-name').val(),
                color: $modalBody.find('#selected-route-color').val(),
                stopIds: stopIds
            };

            const allStopsArray = [];
            $bucket.find('.bucket-item-btn').each(function () {
                allStopsArray.push({
                    id: Number($(this).data('stop-id')),
                    name: $(this).text().trim(),
                    latitude: parseFloat($(this).data('lat')),
                    longitude: parseFloat($(this).data('lon'))
                });
            });

            Modal.close();

            const map = getMap();

            function finishRouteSelection() {
                Banner.hide();
                if (map && typeof map.disableRouteStopsSelection === 'function') {
                    map.disableRouteStopsSelection();
                }
                openAddRouteModal();
            }

            Banner.show({
                text: 'Оберіть наявні зупинки на карті по черзі. Після завершення натисніть "Підтвердити"',
                showConfirm: true,
                onConfirm: finishRouteSelection,
                onCancel: finishRouteSelection
            });

            if (map && typeof map.enableRouteStopsSelection === 'function') {
                map.enableRouteStopsSelection(allStopsArray, savedRouteState.stopIds, function (updatedStopIds) {
                    savedRouteState.stopIds = updatedStopIds;
                    Banner.setText(`Обрано зупинок для маршруту: ${updatedStopIds.length}`);
                });
            }
        });
    }
});