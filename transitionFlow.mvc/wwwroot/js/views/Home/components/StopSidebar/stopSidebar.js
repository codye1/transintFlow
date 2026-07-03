import api from './stopSidebarApi.js';
import validator from './stopSidebarValidator.js';
import Modal from '../../../../helpers/ModalManager.js';
import Banner from '../../../../helpers/SelectionBanner.js';
import { showApiErrors } from '../../../../helpers/showApiErrors.js';

$(function () {
    'use strict';

    let debounceTimer = null;
    let savedStopState = null;
    let temporaryCoords = null;

    const getMap = () => window.TransitMapInstance;

    $(document).on('click', '.btn-delete-stop', function (e) {
        e.stopPropagation();
        const $item = $(this).closest('.stop-item');
        const stopId = $item.data('id');

        if (!confirm('Видалити зупинку?')) return;

        api.deleteStop(stopId)
            .done(() => {
                const map = getMap();
                if (map && typeof map.removeStop === 'function') {
                    map.removeStop(stopId);
                }

                $item.remove();
            })
            .fail((xhr) => {
                if (xhr.status === 401) {
                    window.location.href = '/login';
                    return;
                }
                if (xhr.status === 403) {
                    alert('Немає прав для видалення цієї зупинки');
                    return;
                }
                alert('Помилка видалення зупинки');
            });
    });

    $(document).on('click', '.btn-edit-stop', function (e) {
        e.stopPropagation();
        const $item = $(this).closest('.stop-item');
        const currentName = $item.find('.stop-name b').text().trim();
        $item.find('.edit-input').val(currentName);
        $item.addClass('is-editing');
    });

    $(document).on('click', '.btn-edit-close', function (e) {
        e.stopPropagation();
        $(this).closest('.stop-item').removeClass('is-editing');
    });

    $(document).on('click', '.btn-edit-accept', function (e) {
        e.stopPropagation();
        const $item = $(this).closest('.stop-item');
        const stopId = $item.data('id');
        const newName = $item.find('.edit-input').val().trim();

        if (!newName) {
            alert('Назва зупинки не може бути порожньою');
            return;
        }

        const $btn = $(this);
        $btn.prop('disabled', true);

        const latRaw = $item.attr('data-lat') || "0";
        const lonRaw = $item.attr('data-lon') || "0";

        const updateData = {
            id: stopId,
            name: newName,
            latitude: parseFloat(latRaw.replace(',', '.')),
            longitude: parseFloat(lonRaw.replace(',', '.'))
        };

        api.updateStop(stopId, updateData)
            .done(() => {
                $item.find('.stop-name b').text(newName);
                $item.removeClass('is-editing');

                const map = getMap();
                if (map) {
                    map.updateStopPopup(stopId, newName);
                }
            })
            .fail((xhr) => {
                if (xhr.status === 401) {
                    window.location.href = '/login';
                    return;
                }
                if (xhr.status === 400 && xhr.responseJSON?.errors) {
                    const message = xhr.responseJSON.errors.name?.[0]
                        || xhr.responseJSON.errors.latitude?.[0]
                        || xhr.responseJSON.errors.longitude?.[0]
                        || xhr.responseJSON.errors._general?.[0]
                        || 'Помилка оновлення назви зупинки';
                    alert(message);
                    return;
                }
                alert('Помилка оновлення назви зупинки');
            })
            .always(() => {
                $btn.prop('disabled', false);
            });
    });

    $(document).on('keydown', '.edit-input', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            $(this).closest('.stop-item').find('.btn-edit-accept').click();
        }
        if (e.key === 'Escape') {
            $(this).closest('.stop-item').find('.btn-edit-close').click();
        }
    });

    $(document).on('click', '.stop-item', function (e) {
        if ($(this).hasClass('is-editing') || $(e.target).closest('.stop-actions, .editing-container').length) {
            return;
        }

        const map = getMap();
        const stopId = $(this).data('id');

        let latRaw = $(this).attr('data-lat') || "";
        let lonRaw = $(this).attr('data-lon') || "";

        const lat = parseFloat(latRaw.toString().replace(',', '.'));
        const lon = parseFloat(lonRaw.toString().replace(',', '.'));

        if (!isNaN(lat) && !isNaN(lon) && map) {
            map.focusOnPoint(stopId, lat, lon, 16);
        }
    });

    function openAddStopModal() {
        if (!Modal) {
            console.error('Global Modal manager library instance not found.');
            return;
        }

        Modal.open('Нова зупинка', '#tpl-add-stop', {
            ...validator.stopFormRules,
            showErrors: function (errorMap, errorList) {
                this.defaultShowErrors();

                const $form = $(this.currentForm);
                const $submitBtn = $form.find('#btn-submit-stop');

                if (this.numberOfInvalids() > 0) {
                    $submitBtn.prop('disabled', true);
                } else {
                    $submitBtn.prop('disabled', false);
                }
            },
            submitHandler: (form) => {
                const $form = $(form);

                const stopData = {
                    name: $form.find('#stop-name').val(),
                    type: $form.find('#stop-type').val(),
                    latitude: parseFloat($form.find('#stop-lat').val()),
                    longitude: parseFloat($form.find('#stop-lon').val())
                };

                const $submitBtn = $form.find('#btn-submit-stop');
                $submitBtn.prop('disabled', true).addClass('loading');

                api.createStop(stopData)
                    .done((html) => {
                        savedStopState = null;

                        const $newItem = $(html);
                        $('.stop-list').append($newItem);

                        const map = getMap();
                        if (map && typeof map.addStop === 'function') {
                            const stopId = Number($newItem.data('id'));
                            const latitude = parseFloat(String($newItem.data('lat')).replace(',', '.'));
                            const longitude = parseFloat(String($newItem.data('lon')).replace(',', '.'));

                            map.addStop({
                                id: stopId,
                                name: $newItem.find('.stop-name b').text().trim(),
                                latitude: latitude,
                                longitude: longitude
                            });

                            if (!Number.isNaN(stopId) && !Number.isNaN(latitude) && !Number.isNaN(longitude)) {
                                map.focusOnPoint(stopId, latitude, longitude, 16);
                            }
                        }

                        Modal.close();
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
                        alert('Помилка збереження зупинки');
                    })
                    .always(() => {
                        $submitBtn.prop('disabled', false).removeClass('loading');
                    });
            }
        });

        const $modalBody = $('#modal-body-content');
        const $form = $modalBody.find('form');
        const $submitBtn = $modalBody.find('#btn-submit-stop');
        const $suggestions = $modalBody.find('#search-suggestions');
        const $searchIcon = $modalBody.find('.search-icon');
        const $spinnerIcon = $modalBody.find('.spinner-icon');

        if (savedStopState) {
            $modalBody.find('#stop-name').val(savedStopState.name);
            $modalBody.find('#stop-type').val(savedStopState.type);
            $modalBody.find('#address-search').val(savedStopState.addressSearch || '');
            if (savedStopState.latitude) $modalBody.find('#stop-lat').val(savedStopState.latitude);
            if (savedStopState.longitude) $modalBody.find('#stop-lon').val(savedStopState.longitude);
        }

        function fetchSuggestions(query) {
            if (!query.trim()) {
                $suggestions.addClass('hidden').empty();
                return;
            }

            $searchIcon.addClass('hidden');
            $spinnerIcon.removeClass('hidden');

            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&accept-language=uk`;

            $.getJSON(url, function (data) {
                $suggestions.empty().removeClass('hidden');

                if (data.length === 0) {
                    $suggestions.append('<div class="suggestion-item text-muted">Нічого не знайдено</div>');
                } else {
                    $.each(data, function (idx, item) {
                        const displayName = item.display_name.split(',')[0];
                        const $btn = $(`
                            <li>
                                <button type="button" class="suggestion-item">
                                    <span class="pin">📍</span>
                                    <div class="text-block">
                                        <span class="main-text">${displayName}</span>
                                        <span class="full-text">${item.display_name}</span>
                                    </div>
                                </button>
                            </li>
                        `);

                        $btn.on('click', function () {
                            const lat = parseFloat(item.lat).toFixed(6);
                            const lon = parseFloat(item.lon).toFixed(6);

                            $modalBody.find('#stop-lat').val(lat);
                            $modalBody.find('#stop-lon').val(lon);
                            $modalBody.find('#address-search').val(displayName);

                            $suggestions.addClass('hidden').empty();

                            $submitBtn.prop('disabled', !$form.valid());
                        });

                        $suggestions.append($btn);
                    });
                }
            }).always(function () {
                $searchIcon.removeClass('hidden');
                $spinnerIcon.addClass('hidden');
            });
        }

        $modalBody.on('input', '#address-search', function () {
            const val = $(this).val();
            clearTimeout(debounceTimer);

            if (val.trim().length >= 3) {
                debounceTimer = setTimeout(() => fetchSuggestions(val), 400);
            } else {
                $suggestions.addClass('hidden').empty();
            }
        });

        $modalBody.on('click', '#btn-search-trigger', function () {
            clearTimeout(debounceTimer);
            fetchSuggestions($modalBody.find('#address-search').val());
        });

        $modalBody.on('click', '#btn-pick-on-map', function () {
            savedStopState = {
                name: $modalBody.find('#stop-name').val(),
                type: $modalBody.find('#stop-type').val(),
                addressSearch: $modalBody.find('#address-search').val()
            };

            Modal.close();
            temporaryCoords = null;

            const map = getMap();

            function finishStopSelection() {
                Banner.hide();
                if (map) map.disableMapClickSelection();
                openAddStopModal();
            }

            Banner.show({
                text: 'Натисніть на карту, щоб обрати координати зупинки',
                showConfirm: false,
                onConfirm: function () {
                    if (temporaryCoords) {
                        savedStopState.latitude = temporaryCoords.lat;
                        savedStopState.longitude = temporaryCoords.lon;
                    }
                    finishStopSelection();
                },
                onCancel: finishStopSelection
            });

            if (map) {
                map.enableMapClickSelection(function (lat, lon) {
                    temporaryCoords = { lat, lon };
                    Banner.setText(`Точка обрана: ${lat}, ${lon}`);
                    Banner.showConfirm(true);
                });
            }
        });
    }

    $('#open-modal-btn').on('click', function () {
        savedStopState = null;
        temporaryCoords = null;
        openAddStopModal();
    });
});