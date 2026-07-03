using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using TransitFlow.mvc.Models;
using TransitFlow.mvc.Models.DTO;
using TransitFlow.mvc.Services;

namespace TransitFlow.mvc.Controllers
{
    public abstract class BaseController : Controller
    {
        private static readonly JsonSerializerOptions ApiJsonOptions = new(JsonSerializerDefaults.Web);

        protected async Task<IActionResult> ForwardApiErrorAsync(HttpResponseMessage response)
        {
            ApiErrorResponseDto? errorResponse = null;

            try
            {
                errorResponse = await response.Content.ReadFromJsonAsync<ApiErrorResponseDto>(ApiJsonOptions);
            }
            catch
            {
                errorResponse = null;
            }

            errorResponse ??= new ApiErrorResponseDto();

            return response.StatusCode switch
            {
                HttpStatusCode.Unauthorized => Unauthorized(errorResponse),
                HttpStatusCode.Forbidden => StatusCode(StatusCodes.Status403Forbidden, errorResponse),
                HttpStatusCode.NotFound => NotFound(errorResponse),
                HttpStatusCode.Conflict => Conflict(errorResponse),
                HttpStatusCode.BadRequest => BadRequest(errorResponse),
                _ => StatusCode((int)response.StatusCode, errorResponse)
            };
        }
    }
}